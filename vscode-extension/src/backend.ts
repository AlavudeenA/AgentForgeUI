import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";

let flaskProcess: cp.ChildProcess | undefined;

export function startFlaskBackend(
  extensionPath: string,
  outputChannel: vscode.OutputChannel
): cp.ChildProcess | undefined {
  const config = vscode.workspace.getConfiguration("agenticForge");
  const pythonPath = config.get<string>("pythonPath", "python");
  const flaskPort = config.get<number>("flaskPort", 3456);
  const lmPort = config.get<number>("lmServerPort", 5050);

  // The project root sits one level above the vscode-extension folder
  const projectRoot = path.join(extensionPath, "..");

  if (flaskProcess && !flaskProcess.killed) {
    outputChannel.appendLine("[Backend] Flask already running");
    return flaskProcess;
  }

  outputChannel.appendLine(`[Backend] Starting Flask from ${projectRoot}`);
  outputChannel.appendLine(`[Backend] Python: ${pythonPath}`);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(flaskPort),
    // Point Flask's LLM calls at the VS Code LM server
    OPENAI_API_BASE: `http://localhost:${lmPort}`,
    OPENAI_API_KEY: "vscode-lm",
  };

  flaskProcess = cp.spawn(pythonPath, ["workflow_builder.py"], {
    cwd: projectRoot,
    env,
    shell: true,
  });

  flaskProcess.stdout?.on("data", (data: Buffer) => {
    outputChannel.appendLine(`[Flask] ${data.toString().trim()}`);
  });

  flaskProcess.stderr?.on("data", (data: Buffer) => {
    outputChannel.appendLine(`[Flask ERR] ${data.toString().trim()}`);
  });

  flaskProcess.on("exit", (code) => {
    outputChannel.appendLine(`[Backend] Flask exited with code ${code}`);
    flaskProcess = undefined;
  });

  return flaskProcess;
}

export function stopFlaskBackend(outputChannel: vscode.OutputChannel): void {
  if (flaskProcess && !flaskProcess.killed) {
    outputChannel.appendLine("[Backend] Stopping Flask…");
    flaskProcess.kill();
    flaskProcess = undefined;
  }
}

export function getFlaskProcess(): cp.ChildProcess | undefined {
  return flaskProcess;
}
