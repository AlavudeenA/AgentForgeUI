# Agentic Forge

Multi-agent workflow orchestration platform. Build automation pipelines visually by chaining Python agents on a drag-and-drop canvas. LangGraph runs the execution engine; GitHub Copilot provides the AI.

---

## What it does

- Drag agents and workflow elements onto a canvas and connect them
- Configure each node's inputs in the properties panel
- Run the workflow — agents execute in order, outputs feed into the next agent
- Pause at any step for human review (HITL) before continuing
- Generate workflows from natural language via Copilot
- Save and reload workflows as JSON

---

## Project structure

```
Agent Forge UI/
├── agents/                    # Python agents — auto-discovered at startup
│   └── base_agent/Agent.py    # Base class all agents extend
├── api/routes/                # Flask blueprints (agents, workflows, files)
├── services/workflow_utils.py # Input preparation per agent node
├── utilities.py               # Placeholder resolution engine
├── workflow_builder.py        # Flask entry point
├── agent_registry.py          # Scans agents/ folder on startup
├── agent_descriptions.py      # One-line descriptions shown in the sidebar
├── workflow_jsons/            # Saved workflow definitions
├── webui/                     # React + Vite frontend
│   └── src/
│       ├── components/        # Canvas, nodes, sidebar, panels
│       ├── store/             # Zustand state (useWorkflowStore.js)
│       ├── api/client.js      # All API calls to Flask
│       └── styles/main.css    # Wells Fargo white/red theme
└── vscode-extension/
    └── src/
        ├── extension.ts       # Entry point — registers commands, opens WebView
        ├── server.ts          # Copilot LM proxy (OpenAI-compatible, port 5050)
        └── backend.ts         # Spawns Flask as a child process
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.10+ | Must be on PATH |
| Node.js | 18+ | |
| VS Code | 1.90+ | For extension mode |
| GitHub Copilot | Active subscription | For extension mode |

---

## One-time setup

```bash
# 1. Copy env and fill in credentials (all optional)
copy .env.example .env

# 2. Python dependencies
pip install -r requirements.txt

# 3. React UI — build once (or after any UI changes)
cd webui
npm install
npm run build
cd ..

# 4. VS Code extension dependencies
cd vscode-extension
npm install
cd ..
```

---

## Running the app

### Mode 1 — VS Code Extension (recommended)

No API key needed — uses GitHub Copilot directly.

1. Open the **`Agent Forge UI`** root folder in VS Code (not a subfolder)
2. Press **F5** → compiles the TypeScript extension and opens an Extension Development Host window
3. In the host window: `Ctrl+Shift+P` → **Agentic Forge: Open Agentic Forge**

The UI opens as a panel inside VS Code. Flask (port 3456) and the Copilot LM proxy (port 5050) start automatically.

> GitHub Copilot must be installed and signed in for LM calls to work.

### Mode 2 — Standalone Flask

Point `.env` at any OpenAI-compatible server (`OPENAI_API_BASE`).

```bash
# Windows shortcut
start.bat

# Any OS
python workflow_builder.py
```

Open `http://localhost:3456` in a browser.

### Dev mode (UI hot-reload)

Run Flask and Vite together so React changes reflect instantly without rebuilding:

```bash
# Windows
start_dev.bat

# Manual — two terminals
python workflow_builder.py       # Terminal 1
cd webui && npm run dev          # Terminal 2 → http://localhost:5173
```

---

## How the code fits together

### Backend flow

```
Flask (workflow_builder.py)
  └── agent_registry.py          scans agents/ on startup, builds metadata
  └── api/routes/workflows.py    /run_workflow_langgraph
        └── builds LangGraph StateGraph from the workflow JSON
        └── each node: copies inputs → calls agent.run(state) → stores outputs
        └── HITL nodes pause via threading.Event, resume on /approve or /reject
```

### Frontend flow

```
React App
  └── AgentSidebar     lists agents + workflow elements (draggable)
  └── WorkflowCanvas   @xyflow/react canvas — drag, connect, select nodes
  └── PropertiesPanel  edit selected node's inputs/settings
  └── RunPanel         live status + approve/reject HITL steps
  └── useWorkflowStore Zustand store — single source of truth for nodes/edges/run state
```

### Data flow

1. Agents loaded from `/get_agents` → stored in Zustand
2. User builds workflow on canvas (nodes + edges)
3. `buildAgentsPayload()` topologically sorts agent nodes → sends to `/run_workflow_langgraph`
4. Frontend polls `/workflow/status/<run_id>` every second → updates RunPanel live
5. On completion, outputs available in the Run tab

### Placeholder system

Reference outputs of upstream agents in any input field:

```
{state['agent_name_output']['field_name']}
```

Click any text input while configuring a node — available upstream outputs appear as inline suggestions automatically.

---

## Adding a new agent

**1. Create `agents/my_agent.py`:**

```python
from typing import Optional
from pydantic import BaseModel, Field
from agents.base_agent.Agent import Agent
from utilities import resolve_placeholders_input

class MyAgentInput(BaseModel):
    prompt: str = Field(..., description="Task description",
                        json_schema_extra={"ui_type": "textarea"})
    mode: str = Field("fast", description="Mode",
                      json_schema_extra={"ui_type": "dropdown", "options": ["fast", "thorough"]})
    agent_name: Optional[str] = None  # injected by runtime

class MyAgentOutput(BaseModel):
    result: str
    summary: str

class MyAgentAgent(Agent):
    def __init__(self):
        super().__init__(name="my_agent", role="...", goal="...", backstory="...")

    def run(self, state: dict) -> dict:
        inp = dict(state.get("my_agent_input", {}))
        for k in list(inp):
            inp[k] = resolve_placeholders_input(inp[k], state)
        # business logic here
        state["my_agent_output"] = {"result": "...", "summary": "..."}
        return state
```

**2. Add a description to `agent_descriptions.py`:**

```python
AGENT_DESCRIPTIONS = {
    "my_agent": "One-line description shown in the UI sidebar",
}
```

**3.** Restart Flask or call `POST /refresh_agents_metadata` — the agent appears in the sidebar automatically.

### Input field UI types

| `ui_type` | Renders as |
|-----------|------------|
| `textbox` | Single-line input (default) |
| `textarea` | Multi-line — shows output suggestions on focus |
| `dropdown` | Select — requires `options: [...]` in `json_schema_extra` |
| `file` | File path input |
| `hidden` | Not shown in UI |

---

## Canvas elements

### Workflow Elements (drag from sidebar)

| Category | Element | Use |
|----------|---------|-----|
| **Events** | Start | Marks the beginning of a flow |
| | End | Marks the end of a flow |
| | Timer | Wait / delay step |
| | Message | Wait for an incoming message |
| **Gateways** | XOR | One path chosen based on a condition |
| | Parallel | All paths fire simultaneously |
| **Tasks** | User Task | Manual step — pauses for a person |
| | Service Task | HTTP/API call |
| | Script Task | Runs a script (Python, JS, Bash, Groovy) |
| | Send Task | Send email or notification |
| | MCP Server | Call a Model Context Protocol tool |
| **Other** | Annotation | Text note on the canvas |

### Connecting nodes

- Drag from the **bottom handle** of one node to the **top handle** of another
- Click a connector to set a label or condition (`true`/`false` for XOR branches)

---

## Key configuration

### `.env`

```env
JIRA_TOKEN=
JIRA_SERVER_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=

GITHUB_CLOUD_TOKEN=
GITHUB_ENT_TOKEN=

# Extension mode sets these automatically
OPENAI_API_BASE=http://localhost:5050
OPENAI_API_KEY=none
PORT=3456
```

### VS Code extension settings (`Ctrl+,` → search "Agentic Forge")

| Setting | Default | Description |
|---------|---------|-------------|
| `agenticForge.pythonPath` | `python` | Python executable |
| `agenticForge.flaskPort` | `3456` | Flask port |
| `agenticForge.lmServerPort` | `5050` | Copilot LM proxy port |
| `agenticForge.lmFamily` | `gpt-5-mini` | Copilot model |
| `agenticForge.autoStartBackend` | `true` | Auto-start Flask on activation |

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/get_agents` | All agents with input/output schemas |
| POST | `/refresh_agents_metadata` | Rescan agents folder |
| GET | `/list_workflows` | Saved workflow names |
| GET | `/get_workflow?name=X` | Load a workflow |
| POST | `/save_workflow/<name>` | Save a workflow |
| POST | `/generate_workflow_via_copilot` | Generate from natural language |
| POST | `/run_workflow_langgraph` | Start a run |
| GET | `/workflow/status/<run_id>` | Poll run status |
| POST | `/workflow/approve_lg` | Approve HITL pause |
| POST | `/workflow/reject_lg` | Reject with feedback — agent re-runs |
| GET | `/get_logs` | Application log |

---

## Troubleshooting & Diagnostics

### Step 1 — Run the checklist first (especially on a new machine)

> The `webui/dist/` build folder is gitignored and must be generated locally. This is the most common cause of a black screen after cloning.

```bash
# Confirm Python is available
python --version

# Install Python packages
pip install -r requirements.txt

# Build the React UI (required after every fresh clone)
cd webui
npm install
npm run build
cd ..

# Install extension dependencies
cd vscode-extension
npm install
cd ..
```

---

### Black screen / blank WebView

The loading screen has a dark background — if Flask never starts the UI never loads and it looks like a black screen.

**Check the Output channel first:**
`View → Output → Agentic Forge` — Flask startup errors and LM model status are logged here.

**Run Flask manually to see the exact error:**
```bash
python workflow_builder.py
```

**Check if the port is already in use:**
```bash
# Windows
netstat -ano | findstr 3456
netstat -ano | findstr 5050

# Kill process using port 3456 (replace PID)
taskkill /PID <PID> /F
```

**If ports are blocked by corporate firewall** — change the ports in VS Code settings (`Ctrl+,` → search "Agentic Forge"):
- `agenticForge.flaskPort` → try `8080` or `9000`
- `agenticForge.lmServerPort` → try `8081`

Then update `.env`: `PORT=8080`

---

### Python not found / wrong Python

**Set the full Python path in VS Code settings:**
```
agenticForge.pythonPath = C:\Users\yourname\AppData\Local\Programs\Python\Python311\python.exe
```

Find your Python path:
```bash
# Windows
where python
py -3 -c "import sys; print(sys.executable)"
```

**Virtual environment users** — point `agenticForge.pythonPath` at the venv Python:
```
C:\Users\yourname\project\.venv\Scripts\python.exe
```

---

### Missing packages / import errors

```bash
# Check what's installed
pip list

# Reinstall everything
pip install -r requirements.txt --force-reinstall

# If pip itself is broken
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Check `logs/app.log` for `ImportError` or `ModuleNotFoundError` lines.

---

### F5 does nothing / extension won't launch

- Make sure the **root `Agent Forge UI` folder** is open in VS Code, not a subfolder
- Check the Terminal panel for TypeScript compile errors
- Run `cd vscode-extension && npm install` if `node_modules` is missing
- Try compiling manually: `cd vscode-extension && npm run compile` — errors will be visible

---

### No Copilot model / LM calls failing

- GitHub Copilot extension must be installed and signed in in the **main** VS Code window
- Run `Ctrl+Shift+P` → **Agentic Forge: Refresh LM Model**
- Check `View → Output → Agentic Forge` for `[LM]` lines — it will say which model was cached or why it failed
- If the model family isn't found it falls back to any available Copilot model automatically

---

### UI shows but agents don't appear in sidebar

```bash
# Trigger a rescan without restarting Flask
curl -X POST http://localhost:3456/refresh_agents_metadata
```

Or click the refresh button in the UI toolbar.

- Class names must end exactly in `Input`, `Output`, `Agent` (case-sensitive)
- Check `logs/app.log` for Python import errors in the agent file
- Confirm the agent file is inside the `agents/` folder (not a subfolder)

---

### Workflow run stuck / never completes

- Check `logs/app.log` — each agent logs its start, output, and any exceptions
- If a node has HITL enabled, the run pauses and waits — check the Run tab for an Approve/Reject prompt
- Check for placeholder errors: `WARNING: Placeholder` in the log means a `{state['...']}` reference couldn't be resolved — the upstream agent may have failed

---

### Placeholder not resolving

- Use **single quotes**: `{state['key']['field']}` not double quotes
- The upstream agent must have completed successfully and written its `_output` key
- Check `logs/app.log` for `WARNING: Placeholder` lines

---

### Corporate / office environment issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Black screen after F5 | `webui/dist/` not built | Run `cd webui && npm run build` |
| Flask starts but UI doesn't load | Port 3456 blocked | Change `agenticForge.flaskPort` to `8080` |
| LM calls fail silently | Port 5050 blocked | Change `agenticForge.lmServerPort` to `8081` |
| `python` not found | Python not on system PATH | Set full path in `agenticForge.pythonPath` |
| Packages fail to install | Corporate proxy blocking pip | `pip install -r requirements.txt --proxy http://proxy:port` |
| `npm install` fails | Corporate npm registry | `npm install --registry https://registry.npmjs.org` |

---

### Still stuck?

1. Open `logs/app.log` — the full runtime log is here
2. Open `View → Output → Agentic Forge` — extension-level errors are here
3. Open browser DevTools on `http://localhost:3456` (standalone mode) to check console errors
4. Try standalone mode (`python workflow_builder.py` + browser) to isolate whether the issue is Flask or the VS Code extension
