import asyncio
import importlib.util
import inspect
import json
import os
import threading
import uuid

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from langgraph.graph import END, StateGraph

from agent_registry import AgentRegistry
from agents.base_agent.Agent import Agent
from logger import get_logger
from services.workflow_utils import parse_dynamic_agent_input_format
from utilities import resolve_placeholders_input

logger = get_logger()
workflows_bp = Blueprint("workflows", __name__)

# In-memory run registry  {run_id: {...}}
LANGGRAPH_RUNS: dict = {}

_AGENTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "agents")


# ─── Static file serving ──────────────────────────────────────────────────────

def _webui_dist() -> str:
    return current_app.config.get("WEBUI_DIST", "")


@workflows_bp.route("/")
def serve_index():
    dist = _webui_dist()
    if os.path.isdir(dist):
        return send_from_directory(dist, "index.html")
    fallback = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "webui")
    return send_from_directory(fallback, "index.html")


@workflows_bp.route("/assets/<path:path>")
def serve_assets(path):
    dist = _webui_dist()
    if os.path.isdir(dist):
        return send_from_directory(os.path.join(dist, "assets"), path)
    return ("Not found", 404)


# ─── Workflow CRUD ─────────────────────────────────────────────────────────────

@workflows_bp.route("/list_workflows", methods=["GET"])
def list_workflows():
    folder = current_app.config["WORKFLOW_JSON_FOLDER"]
    names = [f[:-5] for f in os.listdir(folder) if f.endswith(".json")]
    return jsonify(sorted(names))


@workflows_bp.route("/get_workflow", methods=["GET"])
def get_workflow():
    name = request.args.get("name", "")
    folder = current_app.config["WORKFLOW_JSON_FOLDER"]
    path = os.path.join(folder, f"{name}.json")
    if not os.path.exists(path):
        return jsonify({"error": "Not found"}), 404
    with open(path, encoding="utf-8") as f:
        return jsonify(json.load(f))


@workflows_bp.route("/generate_workflow", methods=["POST"])
def generate_workflow():
    data = request.json or {}
    name = data.get("name", f"workflow_{uuid.uuid4().hex[:8]}")
    folder = current_app.config["WORKFLOW_JSON_FOLDER"]
    path = os.path.join(folder, f"{name}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return jsonify({"status": "saved", "name": name})


@workflows_bp.route("/save_workflow/<name>", methods=["POST"])
def save_workflow(name: str):
    data = request.json or {}
    folder = current_app.config["WORKFLOW_JSON_FOLDER"]
    path = os.path.join(folder, f"{name}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return jsonify({"status": "saved", "name": name})


@workflows_bp.route("/delete_workflow/<name>", methods=["DELETE"])
def delete_workflow(name: str):
    folder = current_app.config["WORKFLOW_JSON_FOLDER"]
    path = os.path.join(folder, f"{name}.json")
    if os.path.exists(path):
        os.remove(path)
        return jsonify({"status": "deleted"})
    return jsonify({"error": "Not found"}), 404


# ─── LLM Generate ─────────────────────────────────────────────────────────────

@workflows_bp.route("/generate_workflow_via_copilot", methods=["POST"])
def generate_workflow_via_copilot():
    import re
    import requests as req

    data = request.json or {}
    user_prompt = data.get("prompt", "")

    llm_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "LLMWorkflows")
    context_parts: list[str] = []
    if os.path.isdir(llm_dir):
        for fname in sorted(os.listdir(llm_dir)):
            if fname.endswith(".txt"):
                fpath = os.path.join(llm_dir, fname)
                with open(fpath, encoding="utf-8") as f:
                    context_parts.append(f"=== {fname} ===\n{f.read()}")

    context = "\n\n".join(context_parts)
    full_prompt = (
        "You are an expert workflow architect for Agentic Forge.\n"
        f"Reference materials:\n{context}\n\n"
        f"User request: {user_prompt}\n\n"
        "Return ONLY valid JSON matching the workflow schema. No markdown fences."
    )

    llm_base = os.getenv("OPENAI_API_BASE", "http://localhost:5050")
    api_key = os.getenv("OPENAI_API_KEY", "none")

    try:
        resp = req.post(
            f"{llm_base.rstrip('/')}/v1/chat/completions",
            json={"model": "gpt-4o", "messages": [{"role": "user", "content": full_prompt}]},
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=90,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        content = re.sub(r"^```[a-z]*\n?", "", content.strip())
        content = re.sub(r"\n?```$", "", content.strip())
        workflow_json = json.loads(content)
        return jsonify({"workflow_json": workflow_json, "saved": False})
    except Exception as exc:
        logger.error(f"LLM workflow generation failed: {exc}")
        return jsonify({"error": str(exc)}), 500


# ─── Log tailing ──────────────────────────────────────────────────────────────

@workflows_bp.route("/logs/tail", methods=["GET"])
def tail_logs():
    lines = int(request.args.get("lines", 200))
    log_file = current_app.config["LOG_FILE"]
    if not os.path.exists(log_file):
        return jsonify({"lines": []})
    with open(log_file, encoding="utf-8", errors="replace") as f:
        all_lines = f.readlines()
    return jsonify({"lines": all_lines[-lines:]})


@workflows_bp.route("/get_logs", methods=["GET"])
def get_logs():
    """Spec alias for /logs/tail — returns the full log file content."""
    log_file = current_app.config["LOG_FILE"]
    if not os.path.exists(log_file):
        return jsonify({"lines": []})
    with open(log_file, encoding="utf-8", errors="replace") as f:
        all_lines = f.readlines()
    return jsonify({"lines": all_lines})


# ─── LangGraph execution ───────────────────────────────────────────────────────

def _normalize_agent_config(raw: dict) -> dict:
    """Accept both spec format and internal format, return internal format.

    Spec format:   {"name": "agent_file", "input": {...}, "human_loop": {"enabled": True}}
    Internal format: {"agent_name": "...", "inputs": {...}, "requires_approval": True}
    """
    if "agent_name" in raw:
        return raw  # already internal format

    human_loop = raw.get("human_loop") or {}
    return {
        "agent_name": raw.get("name", ""),
        "node_id": raw.get("node_id", ""),  # may be empty; filled in by _assign_node_ids
        "inputs": raw.get("input") or raw.get("inputs") or {},
        "requires_approval": human_loop.get("enabled", False) if isinstance(human_loop, dict) else bool(human_loop),
    }


def _assign_node_ids(agents_list: list[dict]) -> list[dict]:
    """Give every agent occurrence a unique node_id."""
    counts: dict[str, int] = {}
    for a in agents_list:
        counts[a["agent_name"]] = counts.get(a["agent_name"], 0) + 1

    occurrences: dict[str, int] = {}
    result = []
    for a in agents_list:
        name = a["agent_name"]
        occurrences[name] = occurrences.get(name, 0) + 1
        node_id = name if counts[name] == 1 else f"{name}__{occurrences[name]}"
        result.append({**a, "node_id": node_id})
    return result


def _load_agent_instance(agent_name: str) -> Agent:
    filepath = os.path.join(_AGENTS_DIR, f"{agent_name}.py")
    spec = importlib.util.spec_from_file_location(agent_name, filepath)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for attr_name in dir(module):
        obj = getattr(module, attr_name)
        if inspect.isclass(obj) and issubclass(obj, Agent) and attr_name.endswith("Agent") and attr_name != "Agent":
            return obj()
    raise ValueError(f"No Agent subclass found in agents/{agent_name}.py")


def _append_feedback_to_inputs(state: dict, agent_name: str, node_id: str, feedback: str) -> dict:
    """Append rejection feedback to textarea and prompt-named input fields."""
    node_input_key = f"{node_id}_input"
    node_inputs = state.get(node_input_key, {})

    # Look up which fields are textarea type from the registry
    agent_meta = next((a for a in AgentRegistry.AGENTS if a["name"] == agent_name), None)
    textarea_fields: set[str] = set()
    if agent_meta:
        for fname, fmeta in agent_meta.get("input_format", {}).items():
            if fmeta.get("ui_type") == "textarea" or "prompt" in fname.lower():
                textarea_fields.add(fname)

    appended = False
    for field_name, value in node_inputs.items():
        if isinstance(value, str) and (field_name in textarea_fields or not textarea_fields):
            node_inputs[field_name] = f"{value}\n\n[Rejection feedback]: {feedback}".strip()
            appended = True
            if textarea_fields:
                break  # only append to the first matching textarea/prompt field

    # Fallback: if no matching field found, append to first string field
    if not appended:
        for field_name, value in node_inputs.items():
            if isinstance(value, str):
                node_inputs[field_name] = f"{value}\n\n[Rejection feedback]: {feedback}".strip()
                break

    state[node_input_key] = node_inputs
    return state


def _make_node(agent_instance: Agent, agent_name: str, node_id: str, run_id: str, requires_approval: bool):
    def node_fn(state: dict) -> dict:
        run = LANGGRAPH_RUNS.get(run_id, {})

        # Idempotency — skip if already completed or approved
        current_status = state.get("agent_status", {}).get(node_id, "")
        if current_status in ("completed", "approved"):
            return state

        while True:
            state.setdefault("agent_status", {})[node_id] = "in-progress"
            logger.info(f"AGENT_STATUS|run_id={run_id}|agent={node_id}|status=in-progress")
            if run:
                run["state"] = state

            try:
                # ── Resolve placeholders in this node's input ──────────────────
                node_input_key = f"{node_id}_input"
                base_input_key = f"{agent_name}_input"

                if node_input_key in state:
                    resolved = {k: resolve_placeholders_input(v, state) for k, v in state[node_input_key].items()}
                    state[node_input_key] = resolved
                    # Bridge: agent.run() reads {base_agent_name}_input
                    state[base_input_key] = resolved

                # ── Execute agent ──────────────────────────────────────────────
                state = agent_instance.run(state)

                # ── Dual-key output storage ────────────────────────────────────
                base_output_key = f"{agent_name}_output"
                node_output_key = f"{node_id}_output"
                if base_output_key in state and node_id != agent_name:
                    state[node_output_key] = state[base_output_key]

                # ── Human-in-the-loop pause ────────────────────────────────────
                if requires_approval:
                    state["agent_status"][node_id] = "pending-approval"
                    logger.info(f"AGENT_STATUS|run_id={run_id}|agent={node_id}|status=pending-approval")
                    if run:
                        run["state"] = state

                    event = threading.Event()
                    run.setdefault("approval_events", {})[node_id] = event
                    event.wait(timeout=7200)

                    decision = run.get("decisions", {}).get(node_id, "approved")
                    feedback = run.get("feedbacks", {}).get(node_id, "")

                    if decision == "rejected":
                        logger.info(
                            f"AGENT_STATUS|run_id={run_id}|agent={node_id}|status=rejected"
                            f"|feedback={feedback[:80]}"
                        )
                        # Append feedback to textarea/prompt input fields and re-run
                        state = _append_feedback_to_inputs(state, agent_name, node_id, feedback)
                        # Reset decision so the next iteration can detect a new one
                        run.setdefault("decisions", {})[node_id] = None
                        run.setdefault("feedbacks", {})[node_id] = ""
                        state["agent_status"][node_id] = "not-started"
                        if run:
                            run["state"] = state
                        continue  # re-run the agent

                    # Approved — fall through to completed
                    state["agent_status"][node_id] = "completed"
                    logger.info(f"AGENT_STATUS|run_id={run_id}|agent={node_id}|status=completed")
                    break

                else:
                    state["agent_status"][node_id] = "completed"
                    logger.info(f"AGENT_STATUS|run_id={run_id}|agent={node_id}|status=completed")
                    break

            except Exception as exc:
                state["agent_status"][node_id] = "error"
                state[f"{node_id}_error"] = str(exc)
                logger.error(f"AGENT_STATUS|run_id={run_id}|agent={node_id}|status=error|error={exc}")
                break

        if run:
            run["state"] = state
        return state

    return node_fn


@workflows_bp.route("/run_workflow_langgraph", methods=["POST"])
def run_workflow_langgraph():
    data = request.json or {}
    agents_raw: list[dict] = data.get("agents", [])

    if not agents_raw:
        return jsonify({"error": "No agents provided"}), 400

    # Normalize: accept both spec format and internal format
    agents_input = [_normalize_agent_config(a) for a in agents_raw]

    run_id = str(uuid.uuid4())
    agents_with_ids = _assign_node_ids(agents_input)

    # Truncate log file before each run (spec requirement)
    log_file = current_app.config.get("LOG_FILE", "")
    if log_file and os.path.exists(log_file):
        with open(log_file, "w", encoding="utf-8"):
            pass

    logger.info("=" * 72)
    logger.info(f"WORKFLOW_START|run_id={run_id}|agents={[a['agent_name'] for a in agents_with_ids]}")

    initial_state: dict = {
        "_run_id": run_id,
        "agent_status": {a["node_id"]: "not-started" for a in agents_with_ids},
    }

    for agent_cfg in agents_with_ids:
        initial_state = parse_dynamic_agent_input_format(agent_cfg, initial_state)

    LANGGRAPH_RUNS[run_id] = {
        "state": initial_state,
        "agents": agents_with_ids,
        "completed": False,
        "approval_events": {},
        "decisions": {},
        "feedbacks": {},
        "error": None,
    }

    builder = StateGraph(dict)
    node_ids: list[str] = []

    for agent_cfg in agents_with_ids:
        agent_name = agent_cfg["agent_name"]
        node_id = agent_cfg["node_id"]
        requires_approval = agent_cfg.get("requires_approval", False)

        try:
            agent_instance = _load_agent_instance(agent_name)
        except Exception as exc:
            del LANGGRAPH_RUNS[run_id]
            return jsonify({"error": f"Failed to load agent '{agent_name}': {exc}"}), 500

        node_fn = _make_node(agent_instance, agent_name, node_id, run_id, requires_approval)
        builder.add_node(node_id, node_fn)
        node_ids.append(node_id)

    builder.set_entry_point(node_ids[0])
    for i in range(len(node_ids) - 1):
        builder.add_edge(node_ids[i], node_ids[i + 1])
    builder.add_edge(node_ids[-1], END)

    compiled = builder.compile()
    LANGGRAPH_RUNS[run_id]["graph"] = compiled

    def _run():
        try:
            final = asyncio.run(compiled.ainvoke(initial_state))
            LANGGRAPH_RUNS[run_id]["state"] = final
            LANGGRAPH_RUNS[run_id]["completed"] = True
            logger.info(f"Workflow {run_id} completed")
        except Exception as exc:
            LANGGRAPH_RUNS[run_id]["error"] = str(exc)
            logger.error(f"Workflow {run_id} failed: {exc}")

    threading.Thread(target=_run, daemon=True).start()
    return jsonify({"run_id": run_id, "status": "started"})


@workflows_bp.route("/workflow/status/<run_id>", methods=["GET"])
def workflow_status(run_id: str):
    run = LANGGRAPH_RUNS.get(run_id)
    if run is None:
        return jsonify({"error": "Run not found"}), 404
    state = run["state"]
    return jsonify(
        {
            "run_id": run_id,
            "completed": run["completed"],
            "error": run.get("error"),
            "agent_status": state.get("agent_status", {}),
            "agents": [
                {
                    "node_id": a["node_id"],
                    "agent_name": a["agent_name"],
                    # Prefer node_id key; fall back to base agent name key (single-occurrence case)
                    "output": state.get(f"{a['node_id']}_output") or state.get(f"{a['agent_name']}_output"),
                    "error": state.get(f"{a['node_id']}_error"),
                }
                for a in run.get("agents", [])
            ],
        }
    )


@workflows_bp.route("/workflow/approve_lg", methods=["POST"])
def approve_lg():
    data = request.json or {}
    run_id = data.get("run_id", "")
    node_id = data.get("node_id", "")

    run = LANGGRAPH_RUNS.get(run_id)
    if run is None:
        return jsonify({"error": "Run not found"}), 404

    run.setdefault("decisions", {})[node_id] = "approved"
    event: threading.Event = run.get("approval_events", {}).get(node_id)
    if event:
        event.set()
    return jsonify({"status": "approved"})


@workflows_bp.route("/workflow/reject_lg", methods=["POST"])
def reject_lg():
    data = request.json or {}
    run_id = data.get("run_id", "")
    node_id = data.get("node_id", "")
    feedback = data.get("feedback", "")

    run = LANGGRAPH_RUNS.get(run_id)
    if run is None:
        return jsonify({"error": "Run not found"}), 404

    run.setdefault("decisions", {})[node_id] = "rejected"
    run.setdefault("feedbacks", {})[node_id] = feedback

    state = run["state"]
    state.setdefault("agent_status", {})[node_id] = "rejected"

    event: threading.Event = run.get("approval_events", {}).get(node_id)
    if event:
        event.set()
    return jsonify({"status": "rejected"})
