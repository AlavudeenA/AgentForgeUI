import * as http from "http";
import * as vscode from "vscode";

export type ModelGetter = () => vscode.LanguageModelChat | undefined;

// Same helper pattern from structured-data-search-engine
async function collectStreamText(asyncIterable: AsyncIterable<string>): Promise<string> {
  let out = "";
  for await (const chunk of asyncIterable) out += chunk;
  return out;
}

function buildMessages(rawMessages: Array<{ role: string; content: string }>): vscode.LanguageModelChatMessage[] {
  // Merge system + user into a single User message (vscode.lm has no System role)
  const systemParts = rawMessages
    .filter((m) => m.role === "system")
    .map((m) => m.content);
  const nonSystem = rawMessages.filter((m) => m.role !== "system");

  const messages: vscode.LanguageModelChatMessage[] = [];

  // Prepend system content to the first user message
  nonSystem.forEach((m, i) => {
    const prefix = i === 0 && systemParts.length > 0 ? `[System]\n${systemParts.join("\n")}\n\n[User]\n` : "";
    messages.push(vscode.LanguageModelChatMessage.User(`${prefix}${m.content}`));
  });

  // If only system messages were provided, wrap in a User message
  if (messages.length === 0 && systemParts.length > 0) {
    messages.push(vscode.LanguageModelChatMessage.User(systemParts.join("\n")));
  }

  return messages;
}

export function startLMServer(
  port: number,
  getModel: ModelGetter,
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): http.Server {
  const server = http.createServer(async (req, res) => {
    const corsHeaders: http.OutgoingHttpHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, corsHeaders);
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    // Collect request body
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const data: {
          messages?: Array<{ role: string; content: string }>;
          prompt?: string;
          model?: string;
        } = JSON.parse(body);

        // Support both /v1/chat/completions style AND /call-llm style
        let messages: vscode.LanguageModelChatMessage[];
        if (data.messages && data.messages.length > 0) {
          messages = buildMessages(data.messages);
        } else if (data.prompt) {
          messages = [vscode.LanguageModelChatMessage.User(data.prompt)];
        } else {
          res.writeHead(400, corsHeaders);
          res.end(JSON.stringify({ error: "Provide 'messages' or 'prompt' in request body" }));
          return;
        }

        const model = getModel();
        if (!model) {
          outputChannel.appendLine("[LM Server] No model available — is GitHub Copilot active?");
          res.writeHead(503, corsHeaders);
          res.end(
            JSON.stringify({
              error: "Language model not available. Ensure GitHub Copilot is installed and signed in.",
            })
          );
          return;
        }

        outputChannel.appendLine(`[LM Server] Request → model=${model.name}, messages=${messages.length}`);

        const cts = new vscode.CancellationTokenSource();
        const chatResponse = await model.sendRequest(messages, {}, cts.token);
        const text = await collectStreamText(chatResponse.text);

        outputChannel.appendLine(`[LM Server] Response → ${text.slice(0, 120)}…`);

        // Return OpenAI-compatible shape so Flask code works without changes
        res.writeHead(200, corsHeaders);
        res.end(
          JSON.stringify({
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion",
            model: model.name,
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: text },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          })
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[LM Server] Error: ${msg}`);
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: msg }));
      }
    });
  });

  server.listen(port, "127.0.0.1", () => {
    outputChannel.appendLine(`[LM Server] Listening on http://127.0.0.1:${port}`);
    outputChannel.appendLine(`[LM Server] Flask should set OPENAI_API_BASE=http://localhost:${port}`);
  });

  server.on("error", (err) => {
    outputChannel.appendLine(`[LM Server] Server error: ${err.message}`);
    if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
      vscode.window.showWarningMessage(
        `Agentic Forge: Port ${port} is already in use. Change agenticForge.lmServerPort in settings.`
      );
    }
  });

  context.subscriptions.push({ dispose: () => server.close() });
  return server;
}
