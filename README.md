# Agentic Forge

Multi-agent workflow orchestration platform. Build automation pipelines visually by chaining Python agents on a drag-and-drop canvas. LangGraph runs the execution engine; GitHub Copilot provides the AI.

---

## What it does

- Drag agents and workflow elements onto a canvas and connect them
- Configure each node's inputs in the properties panel
- Run the workflow — agents execute in order, outputs feed into the next agent
- Branch conditionally using XOR gateways (decision nodes)
- Add timed delays between agents using Timer nodes
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
        ├── extension.ts       # Entry point — serves built React dist directly in WebView
        ├── server.ts          # Copilot LM proxy (OpenAI-compatible, port 8081)
        └── backend.ts         # Spawns Flask as a child process
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.10+ | Must be on PATH |
| Node.js | 18+ | |
| VS Code | 1.90+ | For extension mode |
| GitHub Copilot | Active subscription | For LLM features |

---

## One-time setup

```bash
# 1. Python dependencies
pip install -r requirements.txt

# 2. React UI — build once (required after every fresh clone or UI change)
cd webui
npm install
npm run build
cd ..

# 3. VS Code extension dependencies
cd vscode-extension
npm install
cd ..
```

---

## Running the app

### Mode 1 — VS Code Extension (recommended)

1. Open the **`Agent Forge UI`** root folder in VS Code (not a subfolder)
2. Press **F5** → compiles TypeScript and opens an Extension Development Host window
3. In the host window: `Ctrl+Shift+P` → **Agentic Forge: Open Agentic Forge**

Flask (port 3456) and the Copilot LM proxy (port 8081) start automatically.
The React UI is served **directly inside the WebView** — no iframe, no browser needed.

> GitHub Copilot must be installed and signed in for LM calls to work.

### Mode 2 — Standalone browser

```bash
python workflow_builder.py
```

Open `http://localhost:3456` in a browser.

### Dev mode (UI hot-reload)

```bash
# Two terminals
python workflow_builder.py       # Terminal 1
cd webui && npm run dev          # Terminal 2 → http://localhost:5173
```

---

## How the code fits together

### Backend flow

```
Flask (workflow_builder.py)
  └── agent_registry.py          scans agents/ on startup
  └── api/routes/workflows.py    /run_workflow_langgraph
        └── builds LangGraph StateGraph from nodes + edges
        └── agent nodes: resolve inputs → call agent.run(state) → store outputs
        └── timer nodes: time.sleep(seconds)
        └── decision nodes: eval(condition) → conditional edge routing
        └── HITL nodes: pause via threading.Event, resume on /approve or /reject
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
3. `buildWorkflowPayload()` topologically sorts all executable nodes and collects edges
4. Payload sent to `/run_workflow_langgraph` — includes nodes **and** edges so the backend builds the real graph topology
5. Frontend polls `/workflow/status/<run_id>` every 1.5s → updates RunPanel live

### Placeholder system

Reference outputs of upstream agents in any input field:

```
{state['agent_name_output']['field_name']}
```

Click any text input while configuring a node — available upstream outputs appear as inline suggestions automatically.

### Decision (XOR) node

Write a Python expression in the Condition field:

```
state['addition_agent_output']['result'] > 100
```

- **True** → follows the **bottom** handle (Yes path)
- **False** → follows the **right** handle (No path)

The condition is evaluated against the live state dict at runtime.

### Timer node

Enter seconds directly (`30`) or ISO 8601 (`PT1M30S`). The node shows a spinning animation while waiting and turns green when done.

---

## Adding a new agent

**1. Create `agents/my_agent.py`:**

```python
from pydantic import BaseModel, Field
from agents.base_agent.Agent import Agent

class MyAgentInput(BaseModel):
    prompt: str = Field(..., description="Task description",
                        json_schema_extra={"ui_type": "textarea"})

class MyAgentOutput(BaseModel):
    result: str

class MyAgentAgent(Agent):
    def __init__(self):
        super().__init__(name="my_agent", role="...", goal="...", backstory="...")

    def run(self, state: dict) -> dict:
        inputs = state.get("my_agent_input", {})
        # business logic here
        state["my_agent_output"] = {"result": "..."}
        return state
```

**2. Add a description to `agent_descriptions.py`:**

```python
AGENT_DESCRIPTIONS = {
    "my_agent": "One-line description shown in the UI sidebar",
}
```

**3.** Restart Flask or click the refresh button in the sidebar — the agent appears automatically.

### Input field UI types

| `ui_type` | Renders as |
|-----------|------------|
| `textbox` | Single-line input |
| `textarea` | Multi-line — shows output suggestions on focus |
| `dropdown` | Select — requires `options: [...]` in `json_schema_extra` |
| `file` | File path input |
| `hidden` | Not shown in UI |

---

## Canvas elements

| Category | Element | Description |
|----------|---------|-------------|
| **Events** | Timer | Wait / delay — enter seconds or ISO 8601 |
| **Gateways** | XOR (◆) | One path chosen based on a Python condition |
| | Parallel (⊕) | All paths fire simultaneously |
| **Tasks** | User Task | Manual step — pauses for a person |
| | Service Task | HTTP/API call |
| | Script Task | Runs a script |
| | Send Task | Send email or notification |
| | MCP Server | Call a Model Context Protocol tool |
| **Other** | Annotation | Text note on the canvas |

---

## Key configuration

### `.env`

```env
OPENAI_API_BASE=http://localhost:8081
OPENAI_API_KEY=none
PORT=3456
```

### VS Code extension settings (`Ctrl+,` → search "Agentic Forge")

| Setting | Default | Description |
|---------|---------|-------------|
| `agenticForge.pythonPath` | `python` | Python executable |
| `agenticForge.flaskPort` | `3456` | Flask port |
| `agenticForge.lmServerPort` | `8081` | Copilot LM proxy port |
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
| POST | `/run_workflow_langgraph` | Start a run (accepts `agents` + `edges`) |
| GET | `/workflow/status/<run_id>` | Poll run status |
| POST | `/workflow/approve_lg` | Approve HITL pause |
| POST | `/workflow/reject_lg` | Reject with feedback — agent re-runs |
| GET | `/get_logs` | Application log |

---

## Troubleshooting

### Black screen in VS Code extension

**Most common causes (in order):**

| Cause | Fix |
|-------|-----|
| `webui/dist/` not built | `cd webui && npm install && npm run build` |
| Flask not running | Check `View → Output → Agentic Forge` for startup errors |
| Python not found | Set full path: `agenticForge.pythonPath = C:\...\python.exe` |
| Port 3456 blocked | Change `agenticForge.flaskPort` to `8080` and set `PORT=8080` in `.env` |

**How the extension serves the UI:**
The extension reads `webui/dist/index.html` and serves it directly inside the VS Code WebView — no iframe, no browser. If `dist/` is missing you'll see a build instruction screen instead of a black screen.

**Run Flask manually to see errors:**
```bash
python workflow_builder.py
```

**Check if port is in use:**
```bash
netstat -ano | findstr 3456
taskkill /PID <PID> /F
```

---

### Python not found

```
agenticForge.pythonPath = C:\Users\yourname\AppData\Local\Programs\Python\Python311\python.exe
```

Find your path:
```bash
where python
py -3 -c "import sys; print(sys.executable)"
```

---

### Missing packages

```bash
pip install -r requirements.txt --force-reinstall
```

Check `logs/app.log` for `ImportError` lines.

---

### Extension won't launch (F5 does nothing)

- Open the **root `Agent Forge UI` folder** in VS Code, not a subfolder
- Run `cd vscode-extension && npm run compile` — TypeScript errors will be shown
- Run `cd vscode-extension && npm install` if `node_modules` is missing

---

### No Copilot model

- GitHub Copilot must be installed and signed in
- `Ctrl+Shift+P` → **Agentic Forge: Refresh LM Model**
- Check `View → Output → Agentic Forge` for `[LM]` lines

---

### Agents don't appear in sidebar

```bash
curl -X POST http://localhost:3456/refresh_agents_metadata
```

Or click the refresh button (↻) in the sidebar. Agent class names must end in `Agent` (e.g. `MyAgent`).

---

### Placeholder not resolving

- Use **single quotes**: `{state['key']['field']}` not double quotes
- The upstream agent must have completed before this node runs
- Check `logs/app.log` for `WARNING: Placeholder` lines

---

### Corporate / office environment

| Symptom | Fix |
|---------|-----|
| Black screen after F5 | Build the UI: `cd webui && npm run build` |
| Flask starts but UI blank | Port blocked — change `agenticForge.flaskPort` to `8080` |
| LM calls fail | Change `agenticForge.lmServerPort` to `8082` |
| `python` not found | Set full path in `agenticForge.pythonPath` |
| `pip install` fails | `pip install -r requirements.txt --proxy http://proxy:port` |
| `npm install` fails | `npm install --registry https://registry.npmjs.org` |
