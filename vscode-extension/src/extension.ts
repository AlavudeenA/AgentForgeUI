import * as vscode from "vscode";
import { startLMServer } from "./server.js";
import { startFlaskBackend, stopFlaskBackend } from "./backend.js";

// Cached model — selectChatModels only works in user-gesture context,
// so we cache it at activation time (same pattern as structured-data-search-engine)
let cachedModel: vscode.LanguageModelChat | undefined;
let panel: vscode.WebviewPanel | undefined;

async function cacheModel(
  outputChannel: vscode.OutputChannel,
): Promise<vscode.LanguageModelChat | undefined> {
  const config = vscode.workspace.getConfiguration("agenticForge");
  const vendor = config.get<string>("lmVendor", "copilot");
  const family = config.get<string>("lmFamily", "gpt-5-mini");

  try {
    const models = await vscode.lm.selectChatModels({ vendor, family });
    if (models.length > 0) {
      cachedModel = models[0];
      outputChannel.appendLine(`[LM] Model cached: ${cachedModel.name}`);
      return cachedModel;
    }
    // Fallback: try without family constraint
    const fallback = await vscode.lm.selectChatModels({ vendor });
    if (fallback.length > 0) {
      cachedModel = fallback[0];
      outputChannel.appendLine(
        `[LM] Model cached (fallback): ${cachedModel.name}`,
      );
      return cachedModel;
    }
    outputChannel.appendLine(
      "[LM] No models found — install GitHub Copilot and sign in",
    );
  } catch (err) {
    outputChannel.appendLine(`[LM] selectChatModels error: ${err}`);
  }
  return undefined;
}

function getWebviewHtml(flaskPort: number, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; frame-src http://localhost:${flaskPort}; connect-src http://localhost:${flaskPort};" />
  <title>Agentic Forge</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { height: 100vh; overflow: hidden; background: #080c14; font-family: 'Inter', system-ui, sans-serif; }

    #loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 1.5rem;
      color: #94a3b8;
    }

    .logo { font-size: 3rem; filter: drop-shadow(0 0 12px #4f7fff88); }
    .title { font-size: 1.2rem; font-weight: 700; background: linear-gradient(90deg, #4f7fff, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { font-size: 0.85rem; }

    .spinner {
      width: 44px; height: 44px;
      border: 3px solid #243350;
      border-top-color: #4f7fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .dots span { animation: blink 1.4s infinite; }
    .dots span:nth-child(2) { animation-delay: 0.2s; }
    .dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes blink { 0%,80%,100% { opacity: 0; } 40% { opacity: 1; } }

    #error-msg {
      display: none;
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.3);
      border-radius: 8px;
      padding: 1rem 1.5rem;
      color: #ef4444;
      font-size: 0.82rem;
      max-width: 400px;
      text-align: center;
    }

    iframe { width: 100%; height: 100vh; border: none; display: none; }
  </style>
</head>
<body>
  <div id="loading">
    <div class="logo">⚒</div>
    <div class="title">Agentic Forge</div>
    <div class="spinner"></div>
    <div class="subtitle">
      Connecting to backend on port ${flaskPort}<span class="dots"><span>.</span><span>.</span><span>.</span></span>
    </div>
    <div id="error-msg"></div>
  </div>
  <iframe id="app-frame" src="http://localhost:${flaskPort}" allow="clipboard-read; clipboard-write"></iframe>

  <script nonce="${nonce}">
    const frame = document.getElementById('app-frame');
    const loading = document.getElementById('loading');
    const errorMsg = document.getElementById('error-msg');

    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 60 seconds

    const interval = setInterval(() => {
      attempts++;
      fetch('http://localhost:${flaskPort}/get_agents')
        .then(r => {
          if (r.ok) {
            loading.style.display = 'none';
            frame.style.display = 'block';
            clearInterval(interval);
          }
        })
        .catch(() => {
          if (attempts >= MAX_ATTEMPTS) {
            clearInterval(interval);
            errorMsg.style.display = 'block';
            errorMsg.textContent =
              'Could not reach Flask backend on port ${flaskPort}. ' +
              'Run "Agentic Forge: Start Backend Server" from the command palette, ' +
              'or start it manually: python workflow_builder.py';
          }
        });
    }, 1000);
  </script>
</body>
</html>`;
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel("Agentic Forge");
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine("Agentic Forge extension activating…");

  const config = vscode.workspace.getConfiguration("agenticForge");
  const flaskPort = config.get<number>("flaskPort", 3456);
  const lmPort = config.get<number>("lmServerPort", 8081);

  // 1. Cache the LM model immediately (selectChatModels works at activation time)
  await cacheModel(outputChannel);

  // 2. Start the local LM HTTP server — Flask calls this for all AI features
  startLMServer(lmPort, () => cachedModel, context, outputChannel);

  // 3. Optionally start Flask backend automatically
  if (config.get<boolean>("autoStartBackend", true)) {
    outputChannel.appendLine(
      "[Extension] autoStartBackend=true, launching Flask…",
    );
    startFlaskBackend(context.extensionPath, outputChannel);
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand("agentic-forge.openUI", () => {
      if (panel) {
        panel.reveal(vscode.ViewColumn.One);
        return;
      }

      const nonce = generateNonce();
      panel = vscode.window.createWebviewPanel(
        "agenticForge",
        "Agentic Forge",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          // Allow the iframe to load from localhost Flask
          enableFindWidget: false,
        },
      );

      panel.webview.html = getWebviewHtml(flaskPort, nonce);

      panel.onDidDispose(
        () => {
          panel = undefined;
        },
        null,
        context.subscriptions,
      );

      outputChannel.appendLine(
        `[Extension] WebView panel opened → http://localhost:${flaskPort}`,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("agentic-forge.startBackend", () => {
      outputChannel.show(true);
      const proc = startFlaskBackend(context.extensionPath, outputChannel);
      if (proc) {
        vscode.window
          .showInformationMessage(
            `Agentic Forge backend starting on port ${flaskPort}…`,
            "Open UI",
          )
          .then((choice) => {
            if (choice === "Open UI") {
              vscode.commands.executeCommand("agentic-forge.openUI");
            }
          });
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("agentic-forge.refreshModel", async () => {
      cachedModel = undefined;
      const refreshed = await cacheModel(outputChannel);
      const name = refreshed?.name ?? "none";
      vscode.window.showInformationMessage(`Agentic Forge LM model: ${name}`);
    }),
  );

  // ── Cleanup on deactivate ─────────────────────────────────────────────────
  context.subscriptions.push({
    dispose: () => stopFlaskBackend(outputChannel),
  });

  // Auto-open the UI panel
  vscode.commands.executeCommand("agentic-forge.openUI");

  outputChannel.appendLine("Agentic Forge extension activated.");
  outputChannel.appendLine(`  Flask UI  → http://localhost:${flaskPort}`);
  outputChannel.appendLine(
    `  LM Server → http://localhost:${lmPort} (OpenAI-compatible)`,
  );
}

export function deactivate(): void {
  // Resources cleaned up via context.subscriptions
}

function generateNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
