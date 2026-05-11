import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";

let flaskProcess: cp.ChildProcess | undefined;

// Kill every process listening on `port` before we start a new Flask instance.
// This guarantees a fresh Python process that re-scans the agents directory,
// regardless of whether a previous extension host cleaned up properly.
function killOnPort(port: number, outputChannel: vscode.OutputChannel): Promise<void> {
  if (process.platform !== "win32") {
    // On macOS/Linux kill() works correctly, so nothing extra needed.
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    cp.exec(`netstat -ano | findstr :${port}`, (_err, stdout) => {
      if (!stdout?.trim()) { resolve(); return; }

      const pids = new Set<string>();
      for (const line of stdout.split("\n")) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0") {
          pids.add(pid);
        }
      }

      if (pids.size === 0) { resolve(); return; }

      const pidArgs = [...pids].map((p) => `/PID ${p}`).join(" ");
      outputChannel.appendLine(
        `[Backend] Port ${port} occupied — clearing PIDs: ${[...pids].join(", ")}`
      );
      cp.exec(`taskkill /F /T ${pidArgs}`, () => {
        flaskProcess = undefined;
        resolve();
      });
    });
  });
}

export async function startFlaskBackend(
  extensionPath: string,
  outputChannel: vscode.OutputChannel,
): Promise<cp.ChildProcess | undefined> {
  const config = vscode.workspace.getConfiguration("agenticForge");
  const pythonPath = config.get<string>("pythonPath", "python");
  const flaskPort = config.get<number>("flaskPort", 3456);
  const lmPort = config.get<number>("lmServerPort", 8081);

  // Project root is one level above the vscode-extension folder
  const projectRoot = path.join(extensionPath, "..");

  // Always clear the port first — ensures Flask starts fresh with the
  // latest agents on every F5, even if a previous host didn't clean up.
  await killOnPort(flaskPort, outputChannel);
  flaskProcess = undefined;

  outputChannel.appendLine(`[Backend] Starting Flask from ${projectRoot}`);
  outputChannel.appendLine(`[Backend] Python: ${pythonPath}`);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(flaskPort),
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
    if (process.platform === "win32" && flaskProcess.pid) {
      cp.exec(`taskkill /F /T /PID ${flaskProcess.pid}`, (err) => {
        if (err) {
          outputChannel.appendLine(`[Backend] taskkill error: ${err.message}`);
        }
      });
    } else {
      flaskProcess.kill();
    }
    flaskProcess = undefined;
  }
}

export function getFlaskProcess(): cp.ChildProcess | undefined {
  return flaskProcess;
}
