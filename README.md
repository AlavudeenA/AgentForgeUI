# Agentic Forge

A multi-agent workflow orchestration platform. Build, save, and run automation pipelines by chaining Python agents with a drag-and-drop React UI. Powered by LangGraph for orchestration and GitHub Copilot (via VS Code) for AI generation.

---

## Two ways to run

| Mode | LLM source | Where UI opens |
|------|-----------|----------------|
| **VS Code Extension** (recommended) | GitHub Copilot — no API key needed | Inside VS Code as a WebView panel |
| **Standalone Flask** | Any OpenAI-compatible endpoint | Browser at `http://localhost:3456` |

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.10+ | Must be on PATH |
| Node.js | 18+ | For building the React UI |
| npm | 9+ | Bundled with Node.js |
| VS Code | 1.90+ | Required for VS Code extension mode |
| GitHub Copilot extension | Active subscription | Required for VS Code extension mode |

---

## One-time setup (both modes)

### 1. Copy environment file

```bash
copy .env.example .env
```

Edit `.env` with your credentials (all optional — agents degrade gracefully without them):

```env
JIRA_TOKEN=your_jira_token
JIRA_SERVER_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@company.com

GITHUB_CLOUD_TOKEN=ghp_your_cloud_token
GITHUB_ENT_TOKEN=ghp_your_enterprise_token

# Extension mode sets these automatically. Standalone mode: point at any OpenAI-compatible server.
OPENAI_API_BASE=http://localhost:5050
OPENAI_API_KEY=none

PORT=3456
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Build the React UI

```bash
cd webui
npm install
npm run build
cd ..
```

This produces `webui/dist/` which Flask serves automatically. Only needed once (or after UI code changes).

---

## Mode 1 — VS Code Extension (recommended)

The extension starts Flask and the LM server automatically. The UI renders **inside VS Code** as a WebView panel — no browser needed.

### Step 1 — Install extension dependencies

```bash
cd vscode-extension
npm install
cd ..
```

### Step 2 — Open the root folder in VS Code

Open the **`Agent Forge UI`** root folder in VS Code (not the `vscode-extension` subfolder).

### Step 3 — Press F5

VS Code will:
1. Compile the TypeScript extension automatically
2. Open a new **Extension Development Host** window

### Step 4 — Open the UI

In the Extension Development Host window:

```
Ctrl+Shift+P  →  type "Agentic Forge"  →  select "Agentic Forge: Open Agentic Forge"
```

A WebView panel opens inside VS Code. A loading spinner appears while Flask boots (up to ~10 seconds), then the full drag-and-drop UI renders in the panel.

> **GitHub Copilot must be installed and signed in** in your main VS Code window for LM calls to work. The extension host inherits it automatically.

### What happens automatically on F5

| Step | What | Port |
|------|------|------|
| 1 | TypeScript compiled via `tsc` | — |
| 2 | Extension Development Host opens | — |
| 3 | Copilot LM proxy server starts | 5050 |
| 4 | Flask backend starts | 3456 |
| 5 | UI ready (after Flask boots) | — |

### Other commands (Ctrl+Shift+P)

| Command | What it does |
|---------|-------------|
| `Agentic Forge: Open Agentic Forge` | Opens the UI WebView panel |
| `Agentic Forge: Start Backend Server` | Manually starts Flask if it didn't auto-start |
| `Agentic Forge: Refresh LM Model` | Re-caches the Copilot model (use if LM calls fail) |

### Extension settings (Ctrl+,  →  search "Agentic Forge")

| Setting | Default | Description |
|---------|---------|-------------|
| `agenticForge.pythonPath` | `python` | Python executable (use full path if not on PATH) |
| `agenticForge.flaskPort` | `3456` | Flask backend port |
| `agenticForge.lmServerPort` | `5050` | Copilot LM proxy port |
| `agenticForge.autoStartBackend` | `true` | Auto-start Flask when extension activates |
| `agenticForge.lmVendor` | `copilot` | LM vendor |
| `agenticForge.lmFamily` | `gpt-4o` | Model family preference |

---

## Mode 2 — Standalone Flask (no VS Code needed)

Use any OpenAI-compatible endpoint configured in `.env`.

### Start (Windows)

Double-click **`start.bat`** — installs Python deps if needed, then starts Flask.

### Start (any OS)

```bash
python workflow_builder.py
```

Open **http://localhost:3456** in your browser.

### Development mode (hot-reload UI)

Run Flask and the Vite dev server together so UI changes reflect instantly without rebuilding:

**Windows:**
```bash
start_dev.bat
```

**Manual (two terminals):**
```bash
# Terminal 1 — Flask
python workflow_builder.py

# Terminal 2 — Vite
cd webui
npm run dev
```

UI hot-reloads at **http://localhost:5173**. All API calls proxy to Flask at port 3456.

---

## Project structure

```
Agent Forge UI/
├── .vscode/
│   ├── launch.json            # F5 config — launches Extension Development Host
│   └── tasks.json             # Pre-launch TypeScript compile task
│
├── workflow_builder.py        # Flask entrypoint
├── agent_registry.py          # Auto-discovers agents at startup
├── agent_descriptions.py      # Human-readable agent descriptions
├── utilities.py               # Placeholder resolution engine
├── github.py                  # Shared GitHub operations
├── logger.py                  # Rotating logger → logs/app.log
├── requirements.txt
├── .env.example               # Copy to .env and fill in credentials
│
├── agents/                    # Drop new agent files here — auto-discovered
│   ├── base_agent/Agent.py    # Base class all agents extend
│   ├── jira_story_details_agent.py
│   ├── copilot_agent.py
│   ├── github_cloneandsync_agent.py
│   └── github_createpullRequest_agent.py
│
├── api/
│   ├── __init__.py            # Flask app factory
│   └── routes/
│       ├── agents.py          # /get_agents, /refresh_agents_metadata
│       ├── workflows.py       # LangGraph engine + all workflow endpoints
│       ├── files.py           # /upload, /uploaded_files
│       ├── github_routes.py
│       └── tachyon.py
│
├── services/
│   └── workflow_utils.py      # Input preparation for each agent node
│
├── workflow_jsons/            # Saved workflow definitions
│   ├── jira-to-pr.json        # Sample: JIRA → Copilot → GitHub PR
│   └── copilot-generate.json  # Sample: Copilot code generation with HITL
│
├── LLMWorkflows/              # Reference files fed to LLM for workflow generation
│   ├── agents_metadata.txt    # Auto-generated — call /refresh_agents_metadata to update
│   └── workflow_template.txt  # Schema template for the LLM
│
├── webui/                     # React + Vite frontend
│   ├── src/
│   │   ├── components/        # Canvas, nodes, panels, tabs
│   │   ├── store/             # Zustand state management
│   │   ├── api/client.js      # All API calls
│   │   └── styles/main.css    # Wells Fargo white/red theme
│   └── dist/                  # Built output — served by Flask at /
│
├── vscode-extension/
│   ├── src/
│   │   ├── extension.ts       # Entry point — registers commands, opens WebView
│   │   ├── server.ts          # Copilot LM proxy (OpenAI-compatible on port 5050)
│   │   └── backend.ts         # Spawns Flask as a child process
│   ├── out/                   # Compiled JS (generated by tsc)
│   └── package.json
│
├── logs/app.log               # Runtime log — truncated at each workflow run start
├── uploaded_files/            # Files uploaded via the UI
├── start.bat                  # Windows shortcut: start Flask only
├── start_dev.bat              # Windows shortcut: Flask + Vite dev server
└── build_ui.bat               # Windows shortcut: build React UI
```

---

## Adding a new agent

1. Create `agents/my_new_agent.py`:

```python
from typing import Optional
from pydantic import BaseModel, Field
from agents.base_agent.Agent import Agent
from utilities import resolve_placeholders_input

class MyNewAgentInput(BaseModel):
    prompt: str = Field(..., description="Task description",
                        json_schema_extra={"ui_type": "textarea"})
    mode: str = Field("fast", description="Mode",
                      json_schema_extra={"ui_type": "dropdown", "options": ["fast", "thorough"]})
    agent_name: Optional[str] = None  # injected by runtime

class MyNewAgentOutput(BaseModel):
    result: str
    summary: str

class MyNewAgentAgent(Agent):
    def __init__(self):
        super().__init__(name="my_new_agent", role="...", goal="...", backstory="...")

    def run(self, state: dict) -> dict:
        inp = dict(state.get("my_new_agent_input", {}))
        for k in list(inp):
            inp[k] = resolve_placeholders_input(inp[k], state)

        # business logic here
        state["my_new_agent_output"] = {"result": "...", "summary": "..."}
        return state
```

2. Add a description to `agent_descriptions.py`:

```python
AGENT_DESCRIPTIONS = {
    ...
    "my_new_agent": "One-line description shown in the UI sidebar",
}
```

3. Restart Flask — or call `POST /refresh_agents_metadata` from the UI — and the agent appears in the sidebar automatically.

---

## Workflow JSON format

Workflows are stored in `workflow_jsons/<name>.json`. You can create them visually in the UI or write them by hand:

```json
{
  "workflow_name": "JIRA to PR",
  "agents": [
    {
      "name": "jira_story_details_agent",
      "input": {
        "jira_issue_key": "PROJ-123"
      }
    },
    {
      "name": "copilot_agent",
      "input": {
        "prompt": "Implement: {state['jira_story_details_agent_output']['acceptance_criteria']}"
      },
      "human_loop": { "enabled": true }
    },
    {
      "name": "github_createpullRequest_agent",
      "input": {
        "pr_title": "[{state['jira_story_details_agent_output']['issue_key']}] Auto PR",
        "repo": "myorg/myrepo",
        "head_branch": "feature/auto"
      }
    }
  ]
}
```

**Placeholder syntax:** `{state['agent_name_output']['field']}` — single quotes, resolved at runtime from the previous agent's output.

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/get_agents` | All registered agents with input/output schemas |
| POST | `/refresh_agents_metadata` | Rescan agents folder, update LLM context file |
| GET | `/list_workflows` | List saved workflow names |
| GET | `/get_workflow?name=X` | Load a workflow JSON |
| POST | `/save_workflow/<name>` | Save a workflow |
| POST | `/generate_workflow_via_copilot` | Generate workflow JSON from natural language |
| POST | `/run_workflow_langgraph` | Start a workflow run |
| GET | `/workflow/status/<run_id>` | Poll run status and agent outputs |
| POST | `/workflow/approve_lg` | Approve a human-in-the-loop pause |
| POST | `/workflow/reject_lg` | Reject with feedback — agent re-runs |
| GET | `/get_logs` | Full application log |
| POST | `/upload` | Upload a file |
| GET | `/uploaded_files` | List uploaded files |

---

## Troubleshooting

**F5 does nothing / task fails**
- Make sure the **root `Agent Forge UI` folder** is open in VS Code, not a subfolder
- Check the Terminal panel for TypeScript compile errors
- Run `cd vscode-extension && npm install` if node_modules is missing

**Loading spinner never goes away**
- Flask failed to start — check the **Agentic Forge** output channel in VS Code (`View → Output → Agentic Forge`)
- Confirm Python is on PATH: open a terminal and run `python --version`
- Confirm deps are installed: `pip install -r requirements.txt`

**"No Copilot model found" in output channel**
- GitHub Copilot extension must be installed and signed in
- Run `Ctrl+Shift+P` → **"Agentic Forge: Refresh LM Model"**

**UI blank / Cannot connect**
- Ensure the React build exists: run `build_ui.bat` or `cd webui && npm run build`
- Port 3456 must be free — check with `netstat -ano | findstr 3456`

**Agent not appearing in sidebar**
- Class names must end in exactly `Input`, `Output`, `Agent`
- Check `logs/app.log` for import errors
- Call `POST /refresh_agents_metadata` or restart Flask

**Placeholder not resolving**
- Use single quotes: `{state['key']['field']}` not double quotes
- The upstream agent must have completed successfully and written its `_output` key
- Check `logs/app.log` for lines containing `WARNING: Placeholder`
