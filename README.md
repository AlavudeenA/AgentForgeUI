# Agentic Forge

Multi-agent workflow orchestration — drag-and-drop canvas to build, save, and run automation pipelines. Powered by LangGraph for execution and GitHub Copilot for AI generation.

---

## Two ways to run

| Mode | LLM | UI |
|------|-----|----|
| **VS Code Extension** (recommended) | GitHub Copilot (`gpt-5-mini`) — no API key | Inside VS Code WebView |
| **Standalone Flask** | Any OpenAI-compatible endpoint | Browser `http://localhost:3456` |

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ |
| VS Code | 1.90+ |
| GitHub Copilot | Active subscription |

---

## Setup

```bash
# 1. Copy env file and fill in credentials (all optional)
copy .env.example .env

# 2. Python dependencies
pip install -r requirements.txt

# 3. Build the React UI (once, or after UI changes)
cd webui && npm install && npm run build && cd ..

# 4. VS Code extension dependencies
cd vscode-extension && npm install && cd ..
```

---

## Run — VS Code Extension

1. Open the **`Agent Forge UI`** root folder in VS Code
2. Press **F5** — compiles the extension and opens an Extension Development Host
3. In the host window: `Ctrl+Shift+P` → **Agentic Forge: Open Agentic Forge**

The UI opens as a panel inside VS Code. Flask and the Copilot LM proxy start automatically.

| What F5 starts | Port |
|----------------|------|
| Copilot LM proxy | 5050 |
| Flask backend | 3456 |

### Commands (`Ctrl+Shift+P`)

| Command | Action |
|---------|--------|
| `Agentic Forge: Open Agentic Forge` | Open the UI panel |
| `Agentic Forge: Start Backend Server` | Manually start Flask |
| `Agentic Forge: Refresh LM Model` | Re-cache Copilot model |

### Settings (`Ctrl+,` → search "Agentic Forge")

| Setting | Default |
|---------|---------|
| `agenticForge.pythonPath` | `python` |
| `agenticForge.flaskPort` | `3456` |
| `agenticForge.lmServerPort` | `5050` |
| `agenticForge.lmFamily` | `gpt-5-mini` |
| `agenticForge.autoStartBackend` | `true` |

---

## Run — Standalone Flask

```bash
# Windows
start.bat

# Any OS
python workflow_builder.py
```

Open `http://localhost:3456`. Configure `OPENAI_API_BASE` in `.env` to point at any OpenAI-compatible server.

### Dev mode (hot-reload UI)

```bash
# Windows
start_dev.bat

# Manual (two terminals)
python workflow_builder.py          # Terminal 1
cd webui && npm run dev             # Terminal 2 → http://localhost:5173
```

---

## Canvas elements

### Agents
Drop any registered Python agent from the sidebar onto the canvas. Configure inputs in the Properties panel. Click any text field to see available outputs from upstream agents.

### Workflow Elements

| Category | Elements |
|----------|----------|
| **Events** | Start, End, Timer, Message |
| **Gateways** | XOR (exclusive — one path), Parallel (all paths) |
| **Tasks** | User, Service (HTTP), Script, Send (email/notification), MCP Server |
| **Other** | Annotation (text note) |

Connect nodes by dragging from the bottom handle of one to the top of another. Click a connector to set a label or condition (`true`/`false` for XOR branches).

### Placeholder syntax
Reference upstream outputs in any input field:
```
{state['agent_name_output']['field']}
```
Click into any text field — available outputs appear as inline suggestions.

---

## Adding a new agent

1. Create `agents/my_agent.py` with `MyAgentInput`, `MyAgentOutput`, `MyAgentAgent` classes
2. Add a description to `agent_descriptions.py`
3. Restart Flask or call `POST /refresh_agents_metadata`

See existing agents in `agents/` for the pattern.

---

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/get_agents` | All agents with schemas |
| POST | `/refresh_agents_metadata` | Rescan agents folder |
| GET | `/list_workflows` | Saved workflow names |
| GET | `/get_workflow?name=X` | Load a workflow |
| POST | `/save_workflow/<name>` | Save a workflow |
| POST | `/generate_workflow_via_copilot` | Generate from natural language |
| POST | `/run_workflow_langgraph` | Start a run |
| GET | `/workflow/status/<run_id>` | Poll run status |
| POST | `/workflow/approve_lg` | Approve HITL pause |
| POST | `/workflow/reject_lg` | Reject with feedback |
| GET | `/get_logs` | Application log |

---

## Troubleshooting

**F5 does nothing** — open the `Agent Forge UI` root folder, not a subfolder. Run `cd vscode-extension && npm install` if missing.

**Spinner never goes away** — Flask failed to start. Check `View → Output → Agentic Forge`. Confirm `python --version` works and deps are installed.

**No Copilot model** — install GitHub Copilot, sign in, then run `Agentic Forge: Refresh LM Model`.

**UI blank** — run `build_ui.bat` or `cd webui && npm run build`. Port 3456 must be free.

**Agent not in sidebar** — class names must end in `Input`, `Output`, `Agent`. Check `logs/app.log`.
