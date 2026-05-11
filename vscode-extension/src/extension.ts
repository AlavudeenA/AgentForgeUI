import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { startFlaskBackend, stopFlaskBackend } from "./backend.js";
import { startLMServer } from "./server.js";

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
    const fallback = await vscode.lm.selectChatModels({ vendor });
    if (fallback.length > 0) {
      cachedModel = fallback[0];
      outputChannel.appendLine(`[LM] Model cached (fallback): ${cachedModel.name}`);
      return cachedModel;
    }
    outputChannel.appendLine("[LM] No models found — install GitHub Copilot and sign in");
  } catch (err) {
    outputChannel.appendLine(`[LM] selectChatModels error: ${err}`);
  }
  return undefined;
}

function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/**
 * Serve the built React dist directly in the webview.
 * This avoids the iframe + http:// CSP issue that causes black screens in corporate VS Code environments.
 */
function getWebviewContent(
  webview: vscode.Webview,
  extensionPath: string,
  flaskPort: number,
  outputChannel: vscode.OutputChannel,
): string {
  const distDir = path.join(extensionPath, "..", "webui", "dist");
  const indexPath = path.join(distDir, "index.html");

  if (!fs.existsSync(indexPath)) {
    outputChannel.appendLine(`[Extension] dist not found at ${distDir} — show build instructions`);
    return getDistMissingHtml(flaskPort);
  }

  let html = fs.readFileSync(indexPath, "utf-8");

  // Remove crossorigin attributes — they cause CORS errors with vscode-resource:// URIs
  html = html.replace(/\s+crossorigin/g, "");

  // Rewrite /assets/... paths to VS Code webview resource URIs
  html = html.replace(/(src|href)="\/assets\/([^"]+)"/g, (_: string, attr: string, file: string) => {
    const uri = webview.asWebviewUri(vscode.Uri.file(path.join(distDir, "assets", file)));
    return `${attr}="${uri}"`;
  });

  // Inject Flask port and CSP
  const nonce = generateNonce();
  const csp = [
    `default-src 'none'`,
    `script-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-inline'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `img-src ${webview.cspSource} data: blob:`,
    `font-src ${webview.cspSource}`,
    `connect-src http://localhost:${flaskPort}`,
    `worker-src blob:`,
  ].join("; ");

  html = html.replace(
    "<head>",
    `<head>\n  <meta http-equiv="Content-Security-Policy" content="${csp}">\n  <script nonce="${nonce}">window.__FLASK_PORT__=${flaskPort};</script>`,
  );

  outputChannel.appendLine(`[Extension] Serving dist directly from ${distDir}`);
  return html;
}

function getDistMissingHtml(flaskPort: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #080c14; color: #94a3b8; display: flex; align-items: center; justify-content: center;
           height: 100vh; font-family: system-ui, sans-serif; text-align: center; padding: 2rem; }
    h2  { color: #ef4444; margin: 1rem 0 0.5rem; font-size: 1.1rem; }
    p   { font-size: 0.85rem; margin: 0.4rem 0; line-height: 1.5; }
    code { background: #1e2a3a; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 0.85rem; }
    .icon { font-size: 3rem; }
    .box  { max-width: 480px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">⚒</div>
    <h2>UI not built yet</h2>
    <p>The <code>webui/dist/</code> folder is missing.</p>
    <p>Open a terminal in the project root and run:</p>
    <p><code>cd webui &amp;&amp; npm install &amp;&amp; npm run build</code></p>
    <p style="margin-top:1rem">Then press <strong>F5</strong> to reload the extension.</p>
    <p style="margin-top:0.5rem; color:#64748b; font-size:0.78rem">
      Flask is still starting on port ${flaskPort} — you can also open<br/>
      <code>http://localhost:${flaskPort}</code> in a browser once it's ready.
    </p>
  </div>
</body>
</html>`;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel("Agentic Forge");
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine("Agentic Forge extension activating…");

  const config = vscode.workspace.getConfiguration("agenticForge");
  const flaskPort = config.get<number>("flaskPort", 3456);
  const lmPort = config.get<number>("lmServerPort", 8081);

  await cacheModel(outputChannel);
  startLMServer(lmPort, () => cachedModel, context, outputChannel);

  if (config.get<boolean>("autoStartBackend", true)) {
    outputChannel.appendLine("[Extension] autoStartBackend=true, launching Flask…");
    void startFlaskBackend(context.extensionPath, outputChannel);
  }

  const distDir = path.join(context.extensionPath, "..", "webui", "dist");

  context.subscriptions.push(
    vscode.commands.registerCommand("agentic-forge.openUI", () => {
      if (panel) {
        panel.reveal(vscode.ViewColumn.One);
        return;
      }

      panel = vscode.window.createWebviewPanel(
        "agenticForge",
        "Agentic Forge",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          enableFindWidget: false,
          // Allow loading files from the built React dist folder
          localResourceRoots: [vscode.Uri.file(distDir)],
        },
      );

      panel.webview.html = getWebviewContent(
        panel.webview,
        context.extensionPath,
        flaskPort,
        outputChannel,
      );

      panel.onDidDispose(() => { panel = undefined; }, null, context.subscriptions);
      outputChannel.appendLine(`[Extension] WebView opened — Flask on http://localhost:${flaskPort}`);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("agentic-forge.startBackend", () => {
      outputChannel.show(true);
      startFlaskBackend(context.extensionPath, outputChannel).then((proc) => {
        if (proc) {
          vscode.window
            .showInformationMessage(`Agentic Forge backend starting on port ${flaskPort}…`, "Open UI")
            .then((choice) => {
              if (choice === "Open UI") {
                vscode.commands.executeCommand("agentic-forge.openUI");
              }
            });
        }
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("agentic-forge.refreshModel", async () => {
      cachedModel = undefined;
      const refreshed = await cacheModel(outputChannel);
      vscode.window.showInformationMessage(`Agentic Forge LM model: ${refreshed?.name ?? "none"}`);
    }),
  );

  context.subscriptions.push({ dispose: () => stopFlaskBackend(outputChannel) });

  vscode.commands.executeCommand("agentic-forge.openUI");

  outputChannel.appendLine("Agentic Forge extension activated.");
  outputChannel.appendLine(`  Flask UI  → http://localhost:${flaskPort}`);
  outputChannel.appendLine(`  LM Server → http://localhost:${lmPort} (OpenAI-compatible)`);
}

export function deactivate(): void {
  // Resources cleaned up via context.subscriptions
}
