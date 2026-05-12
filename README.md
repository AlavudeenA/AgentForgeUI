# Agentic Forge

Multi-agent workflow orchestration platform. Build automation pipelines visually by chaining Python agents on a drag-and-drop canvas. LangGraph runs the execution engine; GitHub Copilot provides the AI.

---

## What it does

- Drag agents and workflow elements onto a canvas and connect them
- Configure each node's inputs in the properties panel using static values or live state references
- Run workflows — agents execute sequentially or in parallel, outputs feed into downstream agents
- Branch conditionally using Decision (XOR) nodes
- Fan out to parallel branches and merge results at a join agent
- Add timed delays between agents using Timer nodes
- Pause at any step for human review (HITL) before continuing
- Call external tools via MCP (Model Context Protocol) client nodes
- Generate workflows from natural language via Copilot
- Save and reload workflows as JSON
- Drag the live run-status panel anywhere on screen

---

## Project structure

```
Agent Forge UI/
├── agents/                        # Python agents — auto-discovered at startup
│   ├── base_agent/Agent.py        # Base class all agents extend
│   ├── addition_agent.py
│   ├── subtraction_agent.py
│   ├── multiplication_agent.py
│   ├── division_agent.py
│   └── aggregate_results_agent.py
├── api/routes/workflows.py        # Flask blueprints — all routes
├── services/workflow_utils.py     # Input preparation per agent node
├── utilities.py                   # Placeholder resolution engine
├── workflow_builder.py            # Flask entry point
├── agent_registry.py              # Scans agents/ folder on startup
├── agent_descriptions.py          # One-line descriptions shown in the sidebar
├── workflow_jsons/                # Saved workflow definitions (JSON)
├── math_mcp_server.py             # Example standalone MCP server (math tools)
├── .vscode/mcp.json               # MCP server registry (VS Code format)
├── webui/                         # React + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── nodes/             # Canvas node components (one per node type)
│       │   ├── panels/            # PropertiesPanel, RunPanel
│       │   ├── AgentSidebar.jsx   # Left sidebar — drag sources
│       │   └── WorkflowCanvas.jsx # Main canvas
│       ├── store/useWorkflowStore.js  # Zustand — single source of truth
│       ├── api/client.js          # All API calls to Flask
│       └── styles/main.css        # Global styles
└── vscode-extension/
    └── src/
        ├── extension.ts           # Entry point — serves React dist in WebView
        ├── server.ts              # Copilot LM proxy (OpenAI-compatible, port 8081)
        └── backend.ts             # Spawns Flask as a child process
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

## Installation

### 1. Python dependencies

```bash
pip install -r requirements.txt
```

`requirements.txt` includes:

```
flask>=3.0.0
flask-cors>=4.0.0
python-dotenv>=1.0.0
pydantic>=2.0.0
langgraph>=0.2.0
langchain-core>=0.2.0
requests>=2.31.0
mcp>=1.0.0
anyio>=4.0.0        # required by mcp 1.x — must be 4.x, not 3.x
```

> **Note:** `anyio>=4.0.0` is required. `mcp 1.x` uses generic type syntax (`anyio.create_memory_object_stream[...]`) that only works with anyio 4+. If you see `'function' object is not subscriptable` errors, run `pip install "anyio>=4.0"`.

### 2. React UI

```bash
cd webui
npm install
npm run build    # produces webui/dist/ — required for extension and standalone modes
cd ..
```

Run this again after every UI change.

### 3. VS Code extension

```bash
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

> GitHub Copilot must be installed and signed in for LM calls to work.

### Mode 2 — Standalone browser

```bash
python workflow_builder.py
```

Open `http://localhost:3456` in a browser.

### Dev mode (UI hot-reload)

```bash
# Terminal 1
python workflow_builder.py

# Terminal 2
cd webui && npm run dev    # → http://localhost:5173
```

---

## How to create a new agent

Agents are Python files in the `agents/` folder. Flask discovers them automatically on startup — no registration needed beyond the description file.

### Step 1 — Create `agents/my_agent.py`

```python
import time
from pydantic import BaseModel, Field
from agents.base_agent.Agent import Agent
from logger import get_logger

logger = get_logger()


class MyAgentInput(BaseModel):
    prompt: str = Field(..., description="Task description",
                        json_schema_extra={"ui_type": "textarea"})
    value: str = Field(..., description="A number or text",
                       json_schema_extra={"ui_type": "textbox"})


class MyAgentOutput(BaseModel):
    result: str


class MyAgentAgent(Agent):                          # class name must end in "Agent"
    def __init__(self):
        super().__init__(
            name="my_agent",                        # must match the filename (without .py)
            role="My Role",
            goal="What this agent achieves",
            backstory="Brief background"
        )

    def run(self, state: dict) -> dict:
        inputs = state.get("my_agent_input", {})   # key = {name}_input
        prompt = inputs.get("prompt", "")
        value = inputs.get("value", "")

        # Optional: simulate processing time
        time.sleep(5)

        # Do the work
        result = f"Processed: {prompt} with {value}"
        logger.info(f"MyAgent: {result}")

        state["my_agent_output"] = {"result": result}   # key = {name}_output
        return state
```

**Rules:**
- Filename (without `.py`) must equal the `name` passed to `super().__init__()`
- The class name must end in `Agent`
- Read inputs from `state["{name}_input"]`
- Write outputs to `state["{name}_output"]` as a dict
- Return the full `state` dict

### Step 2 — Add a description to `agent_descriptions.py`

```python
AGENT_DESCRIPTIONS = {
    ...
    "my_agent": "One-line description shown in the UI sidebar",
}
```

### Step 3 — Restart Flask

The new agent appears in the sidebar automatically. Or click the ↻ refresh button in the sidebar without restarting.

---

### Input field UI types

| `ui_type` | Renders as | Use for |
|-----------|------------|---------|
| `textbox` | Single-line input | Numbers, short strings, placeholders |
| `textarea` | Multi-line — shows output suggestions on focus | Prompts, long text |
| `dropdown` | `<select>` | Fixed choices — add `options: ["a", "b"]` in `json_schema_extra` |
| `file` | File path input | File references |
| `hidden` | Not shown | Internally computed values |

---

## How to create a new canvas node type

A canvas node type is a React component that renders on the workflow canvas. Adding one requires changes in 4 files.

### Step 1 — Create `webui/src/components/nodes/MyTaskNode.jsx`

```jsx
import { Handle, Position } from "@xyflow/react";

export default function MyTaskNode({ data, selected }) {
  return (
    <div className={`bpmn-node task-node${selected ? " selected" : ""}`}
         style={{ borderColor: "#7c3aed" }}>
      <Handle type="target" position={Position.Left} />
      <div className="task-node__icon">⚡</div>
      <div className="task-node__label">{data.label || "My Task"}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

### Step 2 — Register it in `WorkflowCanvas.jsx`

```jsx
import MyTaskNode from "./nodes/MyTaskNode.jsx";

// Add to NODE_TYPES object:
const NODE_TYPES = {
  ...
  myTaskNode: MyTaskNode,
};

// Add a color for the minimap:
const TASK_NODE_COLORS = {
  ...
  myTaskNode: "#7c3aed",
};

// Add to SHAPE_ADDERS:
const SHAPE_ADDERS = {
  ...
  myTask: (pos) => addMyTaskNode(pos),
};
```

### Step 3 — Add `addMyTaskNode` action to `useWorkflowStore.js`

```js
addMyTaskNode: (position) => {
  const id = `node-${Date.now()}`;
  set((s) => ({
    nodes: [...s.nodes, {
      id,
      type: "myTaskNode",
      position,
      data: { label: "My Task", someConfig: "" },
    }],
  }));
},
```

### Step 4 — Add a sidebar button in `AgentSidebar.jsx`

```jsx
<ShapeButton shapeKey="myTask" icon="⚡" label="My Task" title="Description of what this does" />
```

### Step 5 — Handle it in `PropertiesPanel.jsx` (optional)

Add a panel component that renders when `node.type === "myTaskNode"` is selected.

### Step 6 — Build the UI

```bash
cd webui && npm run build
```

---

## How to create a workflow

### Method 1 — Visual canvas (recommended)

1. Open the app
2. Drag agents from the left sidebar onto the canvas
3. Connect nodes by dragging from one node's right handle to another's left handle
4. Click a node to open the Properties panel on the right and fill in inputs
5. Use the **Save** button (top toolbar) to save as a named JSON file

### Method 2 — Load a saved JSON

1. Click **Load** in the top toolbar
2. Select a saved workflow from the list
3. Edit nodes/edges, then save again

### Method 3 — Generate from natural language (Copilot)

1. Click the **Copilot** ✨ button in the toolbar
2. Describe the workflow: _"Add two numbers, then check if the result is over 10, if yes multiply by 3"_
3. The workflow is built automatically on the canvas

### Method 4 — Write a JSON file directly

Create a file in `workflow_jsons/` — format:

```json
{
  "name": "my-workflow",
  "nodes": [
    {
      "id": "node-1",
      "type": "agentNode",
      "position": { "x": 100, "y": 100 },
      "data": {
        "agentName": "addition_agent",
        "label": "Addition Agent",
        "inputs": { "operand_a": "10", "operand_b": "5" },
        "requires_approval": false
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "type": "customEdge"
    }
  ]
}
```

---

## Workflow patterns

### Sequential

```
Agent A → Agent B → Agent C
```

Connect output handle of A to input handle of B, B to C. Agents run one at a time.

### Parallel (fan-out → fan-in)

```
Agent A ──→ Agent B ──┐
         ──→ Agent C ──┤→ Aggregate Agent
         ──→ Agent D ──┘
```

Connect A to B, C, and D. Connect B, C, D all to the Aggregate Agent. The three branches run simultaneously. The aggregate agent receives all results via state placeholders.

> **Important:** LangGraph requires a state merge reducer for parallel branches. This is already handled — `_merge_state` in `api/routes/workflows.py` deep-merges parallel updates.

### Conditional (XOR branch)

```
Agent A → ◆ Decision ──[yes]──→ Agent B
                     ──[no]───→ Agent C
```

Write a Python condition in the Decision node, e.g.:
```python
state['addition_agent_output']['result'] > 10
```

- **Yes (bottom handle)** — condition is `True`
- **No (right handle)** — condition is `False`

### Human-in-the-loop (HITL)

Enable **Requires Approval** on any agent node in the Properties panel. The workflow pauses after that agent runs and shows Approve / Reject buttons. If rejected, enter feedback — the agent re-runs with the feedback appended to its input.

---

## Placeholder system

Reference outputs from any upstream agent in any input field:

```
{state['agent_name_output']['field_name']}
```

**Examples:**

| What you want | Placeholder |
|---------------|-------------|
| Addition result | `{state['addition_agent_output']['result']}` |
| Aggregate total | `{state['aggregate_results_agent_output']['total']}` |
| MCP result | `{state['mcp_result']['result']}` |

Click any textbox or textarea while editing a node — the available upstream outputs appear as inline suggestions automatically.

---

## MCP (Model Context Protocol) client

MCP nodes call tools on external MCP servers without writing any HTTP code.

### Step 1 — Configure `.vscode/mcp.json`

```json
{
  "servers": {
    "math-server": {
      "type": "http",
      "url": "http://localhost:8090/mcp"
    },
    "my-api": {
      "type": "http",
      "url": "http://my-api-host/mcp",
      "apiKey": "optional-bearer-token"
    }
  }
}
```

Supported transport types: `http` (streamable-HTTP), `sse` (Server-Sent Events).

### Step 2 — Start your MCP server

An example server is included (`math_mcp_server.py`):

```bash
python math_mcp_server.py
# → Math MCP server starting on http://localhost:8090/mcp
```

### Step 3 — Drop an MCP node on the canvas

1. Drag **🔌 MCP** from the sidebar onto the canvas
2. In the Properties panel:
   - Select the server from the **Server** dropdown
   - Click **⟳ Fetch** to load available tools
   - Click a tool — its argument keys are pre-filled in the Arguments box
   - Fill in argument values (static or placeholders)
   - Set an **Output Key** (default: `mcp_result`)

### Step 4 — Use the MCP result downstream

```
{state['mcp_result']['result']}
```

### Writing your own MCP server

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("my-server", host="127.0.0.1", port=8091)

@mcp.tool()
def greet(name: str) -> str:
    """Return a greeting."""
    return f"Hello, {name}!"

if __name__ == "__main__":
    mcp.run(transport="streamable-http")
```

> **Dependency note:** `mcp>=1.0.0` requires `anyio>=4.0.0`. Make sure both are installed.

---

## Canvas node reference

| Category | Node | Key | Description |
|----------|------|-----|-------------|
| **Agents** | Agent | `agentNode` | Runs a Python agent from `agents/` |
| **Events** | Timer | `timerEventNode` | Wait — enter seconds (`30`) or ISO 8601 (`PT1M30S`) |
| **Gateways** | Decision (XOR) ◆ | `decisionNode` | Branch on a Python condition |
| | Parallel ⊕ | `parallelGatewayNode` | Visual marker for parallel split (cosmetic) |
| **Tasks** | User Task | `userTaskNode` | Manual step (visual marker) |
| | Service Task | `serviceTaskNode` | HTTP/API call (visual marker) |
| | Script Task | `scriptTaskNode` | Script step (visual marker) |
| | Send Task | `sendTaskNode` | Notification step (visual marker) |
| | MCP Client 🔌 | `mcpTaskNode` | Calls a tool from `.vscode/mcp.json` |
| **Other** | Annotation | `annotationNode` | Text note — not executed |

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
| DELETE | `/delete_workflow/<name>` | Delete a workflow |
| POST | `/generate_workflow_via_copilot` | Generate from natural language |
| GET | `/mcp_servers` | List servers from `.vscode/mcp.json` |
| POST | `/mcp_list_tools` | List tools for a named server `{ "server_name": "..." }` |
| POST | `/run_workflow_langgraph` | Start a run — accepts `{ agents, edges }` |
| GET | `/workflow/status/<run_id>` | Poll run status and agent outputs |
| POST | `/workflow/approve_lg` | Approve a HITL pause `{ run_id, node_id }` |
| POST | `/workflow/reject_lg` | Reject with feedback — agent re-runs `{ run_id, node_id, feedback }` |
| GET | `/get_logs` | Full application log |
| GET | `/logs/tail?lines=200` | Last N log lines |

---

## Troubleshooting

### Black screen in VS Code extension

| Cause | Fix |
|-------|-----|
| `webui/dist/` not built | `cd webui && npm install && npm run build` |
| Flask not running | Check `View → Output → Agentic Forge` for startup errors |
| Python not found | Set full path: `agenticForge.pythonPath = C:\...\python.exe` |
| Port 3456 blocked | Change `agenticForge.flaskPort` to `8080` and set `PORT=8080` in `.env` |

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

### `'function' object is not subscriptable` on MCP Fetch

`anyio` 3.x is installed. Upgrade it:

```bash
pip install "anyio>=4.0"
```

---

### `Can receive only one value per step` on parallel workflow

This is a LangGraph error from parallel branches writing to the same state key without a reducer. It is already fixed in `api/routes/workflows.py` via `StateGraph(Annotated[dict, _merge_state])`. If you see it, make sure you are running the latest backend code.

---

### Python not found

```
agenticForge.pythonPath = C:\Users\yourname\AppData\Local\Programs\Python\Python313\python.exe
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
- Run `cd vscode-extension && npm run compile` to surface TypeScript errors
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

Or click the ↻ refresh button in the sidebar. The agent class name must end in `Agent` (e.g. `AdditionAgent`).

---

### Placeholder not resolving

- Use **single quotes inside curly braces**: `{state['key']['field']}` — double quotes break parsing
- The upstream agent must have completed before this node runs
- Check `logs/app.log` for `WARNING: Placeholder` lines

---

### Corporate / proxy environment

| Symptom | Fix |
|---------|-----|
| Flask starts but UI blank | Port blocked — change `agenticForge.flaskPort` to `8080` |
| LM calls fail | Change `agenticForge.lmServerPort` to `8082` |
| `pip install` fails | `pip install -r requirements.txt --proxy http://proxy:port` |
| `npm install` fails | `npm install --registry https://registry.npmjs.org` |
