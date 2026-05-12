import asyncio
import importlib.util
import inspect
import json
import os
import re
import threading
import time
import uuid
from typing import Annotated

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

    # Collect paths to existing workflow JSON files as examples for the agent to read
    wf_dir = os.path.join(_PROJECT_ROOT, "workflow_jsons")
    example_paths: list[str] = []
    if os.path.isdir(wf_dir):
        for fname in sorted(os.listdir(wf_dir)):
            if fname.endswith(".json"):
                example_paths.append(os.path.join(wf_dir, fname))

    # Optional hand-written docs from LLMWorkflows/
    llm_dir = os.path.join(_PROJECT_ROOT, "LLMWorkflows")
    doc_paths: list[str] = []
    if os.path.isdir(llm_dir):
        for fname in sorted(os.listdir(llm_dir)):
            if fname.endswith(".txt"):
                doc_paths.append(os.path.join(llm_dir, fname))

    path_lines = "\n".join(f"  - {p}" for p in example_paths)
    doc_lines = "\n".join(f"  - {p}" for p in doc_paths) if doc_paths else "  (none)"

    full_prompt = (
        "You are an expert workflow architect for Agentic Forge.\n\n"
        "Before generating, read the following example workflow JSON files to understand "
        "the exact node types, edge format, input placeholders, and JSON structure to use:\n"
        f"{path_lines}\n\n"
        + (f"Additional reference docs:\n{doc_lines}\n\n" if doc_paths else "")
        + f"User request: {user_prompt}\n\n"
        "Return ONLY valid JSON matching the workflow schema. No markdown fences."
    )

    llm_base = os.getenv("OPENAI_API_BASE", "http://localhost:8081")
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


# ─── MCP config + client ──────────────────────────────────────────────────────

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))


def _load_mcp_config() -> dict:
    """Read mcp.json from .vscode/mcp.json or mcp.json in the project root.

    Supports VS Code format  { "servers": { "name": { "url": "...", "type": "http"|"sse" } } }
    and Claude Desktop format { "mcpServers": { "name": { "url": "...", "transport": "..." } } }.
    Returns { server_name: { "url": str, "transport": str, "headers": dict } }.
    """
    candidates = [
        os.path.join(_PROJECT_ROOT, ".vscode", "mcp.json"),
        os.path.join(_PROJECT_ROOT, "mcp.json"),
    ]
    for path in candidates:
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            raw = data.get("servers") or data.get("mcpServers") or {}
            result = {}
            for name, cfg in raw.items():
                url = cfg.get("url", "")
                transport = cfg.get("type") or cfg.get("transport", "auto")
                if transport == "http":
                    transport = "streamable-http"
                headers = {}
                if cfg.get("apiKey"):
                    headers["Authorization"] = f"Bearer {cfg['apiKey']}"
                if cfg.get("headers"):
                    headers.update(cfg["headers"])
                result[name] = {"url": url, "transport": transport, "headers": headers}
            return result
    return {}


def _mcp_use_sse(url: str, transport: str) -> bool:
    return transport == "sse" or (transport == "auto" and url.rstrip("/").endswith("/sse"))


async def _call_mcp_tool(url: str, tool_name: str, arguments: dict,
                         headers: dict, transport: str = "auto") -> dict:
    try:
        from mcp import ClientSession  # type: ignore
    except ImportError as exc:
        raise RuntimeError("MCP package not installed. Run: pip install mcp") from exc

    try:
        if _mcp_use_sse(url, transport):
            from mcp.client.sse import sse_client  # type: ignore
            async with sse_client(url, headers=headers) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.call_tool(tool_name, arguments)
        else:
            from mcp.client.streamable_http import streamablehttp_client  # type: ignore
            async with streamablehttp_client(url, headers=headers) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.call_tool(tool_name, arguments)
    except Exception as exc:
        raise RuntimeError(f"MCP call failed ({url} / {tool_name}): {exc}") from exc

    content_list = getattr(result, "content", [])
    if content_list:
        first = content_list[0]
        text = getattr(first, "text", None)
        if text is not None:
            try:
                return json.loads(text)
            except (json.JSONDecodeError, TypeError):
                return {"result": text}
        data = getattr(first, "data", None)
        if data is not None:
            return {"result": str(data)}
    return {"result": str(result)}


async def _list_mcp_tools_from_config(server_name: str) -> list[dict]:
    config = _load_mcp_config()
    if server_name not in config:
        raise ValueError(f"Server '{server_name}' not found in mcp.json")
    cfg = config[server_name]
    try:
        from mcp import ClientSession  # type: ignore
    except ImportError as exc:
        raise RuntimeError("MCP package not installed. Run: pip install mcp") from exc

    url, headers, transport = cfg["url"], cfg["headers"], cfg["transport"]
    if _mcp_use_sse(url, transport):
        from mcp.client.sse import sse_client  # type: ignore
        async with sse_client(url, headers=headers) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.list_tools()
    else:
        from mcp.client.streamable_http import streamablehttp_client  # type: ignore
        async with streamablehttp_client(url, headers=headers) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.list_tools()

    tools_list = getattr(result, "tools", [])
    if callable(tools_list):
        tools_list = tools_list()

    output = []
    for t in (tools_list or []):
        name = getattr(t, "name", str(t))
        description = getattr(t, "description", "") or ""

        # inputSchema varies by SDK version — may be a dict, pydantic model, or method
        schema = getattr(t, "inputSchema", None) or getattr(t, "input_schema", None)
        if callable(schema):
            try:
                schema = schema()
            except Exception:
                schema = {}
        if schema is not None and not isinstance(schema, dict):
            try:
                schema = schema.model_dump() if hasattr(schema, "model_dump") else dict(schema)
            except Exception:
                schema = {}
        output.append({"name": name, "description": description, "inputSchema": schema or {}})

    return output


def _make_mcp_node(server_name: str, tool_name: str, arguments_str: str,
                   output_key: str, node_id: str, run_id: str):
    async def node_fn(state: dict) -> dict:
        run = LANGGRAPH_RUNS.get(run_id, {})
        if state.get("agent_status", {}).get(node_id) == "completed":
            return state

        state.setdefault("agent_status", {})[node_id] = "in-progress"
        logger.info(f"AGENT_STATUS|run_id={run_id}|agent={node_id}|status=in-progress|mcp_tool={tool_name}")
        if run:
            run["state"] = state

        try:
            config = _load_mcp_config()
            if server_name not in config:
                raise RuntimeError(f"MCP server '{server_name}' not found in mcp.json")
            cfg = config[server_name]

            resolved = resolve_placeholders_input(arguments_str or "{}", state)
            try:
                arguments = json.loads(resolved) if resolved.strip() else {}
            except json.JSONDecodeError:
                arguments = {}

            result = await _call_mcp_tool(cfg["url"], tool_name, arguments, cfg["headers"], cfg["transport"])

            actual_key = output_key or "mcp_result"
            state[actual_key] = result
            state[f"{node_id}_output"] = result
            state["agent_status"][node_id] = "completed"
            logger.info(f"AGENT_STATUS|run_id={run_id}|agent={node_id}|status=completed")
        except Exception as exc:
            state["agent_status"][node_id] = "error"
            state[f"{node_id}_error"] = str(exc)
            logger.error(f"AGENT_STATUS|run_id={run_id}|agent={node_id}|status=error|error={exc}")

        if run:
            run["state"] = state
        return state

    return node_fn


@workflows_bp.route("/mcp_servers", methods=["GET"])
def mcp_servers():
    config = _load_mcp_config()
    return jsonify({"servers": [{"name": n, "url": c["url"]} for n, c in config.items()]})


@workflows_bp.route("/mcp_list_tools", methods=["POST"])
def mcp_list_tools_route():
    data = request.json or {}
    server_name = data.get("server_name", "").strip()
    if not server_name:
        return jsonify({"error": "server_name is required"}), 400
    try:
        tools = asyncio.run(_list_mcp_tools_from_config(server_name))
        return jsonify({"tools": tools})
    except Exception as exc:
        logger.error(f"mcp_list_tools failed: {exc}")
        return jsonify({"error": str(exc)}), 500


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


# ─── Node handler registry ────────────────────────────────────────────────────
# Maps node_type string → factory(cfg, node_id, run_id) → node_fn.
# To add a new executable node type: add one entry here + a React registry entry.
_NODE_HANDLER_REGISTRY: dict = {}


def _node_handler(node_type: str):
    """Decorator that registers a node handler factory."""
    def decorator(fn):
        _NODE_HANDLER_REGISTRY[node_type] = fn
        return fn
    return decorator


# Derived from registry so _assign_node_ids and input parsing skip them
def _special_node_types():
    return tuple(_NODE_HANDLER_REGISTRY.keys())


@_node_handler("timer")
def _timer_factory(cfg: dict, node_id: str, run_id: str):
    return _make_timer_node(cfg.get("timer_value", "5"), node_id, run_id)


@_node_handler("decision")
def _decision_factory(cfg: dict, node_id: str, run_id: str):
    return _make_decision_node(cfg.get("condition", "False"), node_id, run_id)


@_node_handler("mcp")
def _mcp_factory(cfg: dict, node_id: str, run_id: str):
    return _make_mcp_node(
        cfg.get("server_name", ""),
        cfg.get("tool_name", ""),
        cfg.get("arguments", ""),
        cfg.get("output_key", "mcp_result"),
        node_id, run_id,
    )


def _merge_state(left: dict, right: dict) -> dict:
    """Merge two parallel state updates. Nested dicts (e.g. agent_status) are merged key-by-key
    so that simultaneous updates from parallel branches are combined rather than overwriting."""
    merged = dict(left)
    for key, val in right.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(val, dict):
            merged[key] = {**merged[key], **val}
        else:
            merged[key] = val
    return merged


def _assign_node_ids(agents_list: list[dict]) -> list[dict]:
    """Preserve canvas node_ids if already set; auto-assign for spec-format entries without one."""
    needs_assign = [a for a in agents_list
                    if not a.get("node_id") and a.get("node_type") not in _special_node_types()]
    counts: dict[str, int] = {}
    for a in needs_assign:
        counts[a["agent_name"]] = counts.get(a["agent_name"], 0) + 1

    occurrences: dict[str, int] = {}
    result = []
    for a in agents_list:
        if a.get("node_id") or a.get("node_type") in _special_node_types():
            result.append(a)
            continue
        name = a["agent_name"]
        occurrences[name] = occurrences.get(name, 0) + 1
        node_id = name if counts[name] == 1 else f"{name}__{occurrences[name]}"
        result.append({**a, "node_id": node_id})
    return result


def _parse_iso8601_duration(value: str) -> float:
    """Parse duration to seconds. Accepts plain numbers (seconds) or ISO 8601 (PT5S, PT1M, PT1H)."""
    v = value.strip()
    try:
        return float(v)
    except ValueError:
        pass
    pattern = re.compile(
        r"P(?:(?P<days>\d+)D)?"
        r"(?:T(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+(?:\.\d+)?)S)?)?"
    )
    match = pattern.fullmatch(v.upper())
    if not match:
        raise ValueError(f"Invalid duration: {value!r} — use seconds (e.g. 30) or ISO 8601 (e.g. PT1M30S)")
    parts = match.groupdict(default="0")
    return (
        float(parts["days"]) * 86400
        + float(parts["hours"]) * 3600
        + float(parts["minutes"]) * 60
        + float(parts["seconds"])
    )


def _make_timer_node(timer_value: str, node_id: str, run_id: str):
    def node_fn(state: dict) -> dict:
        run = LANGGRAPH_RUNS.get(run_id, {})

        if state.get("agent_status", {}).get(node_id) == "completed":
            return state

        state.setdefault("agent_status", {})[node_id] = "in-progress"
        logger.info(f"AGENT_STATUS|run_id={run_id}|agent={node_id}|status=in-progress|timer={timer_value}")
        if run:
            run["state"] = state

        try:
            seconds = _parse_iso8601_duration(timer_value)
            logger.info(f"Timer {node_id}: sleeping {seconds:.1f}s ({timer_value})")
            time.sleep(seconds)
            state["agent_status"][node_id] = "completed"
            logger.info(f"AGENT_STATUS|run_id={run_id}|agent={node_id}|status=completed")
        except Exception as exc:
            state["agent_status"][node_id] = "error"
            state[f"{node_id}_error"] = str(exc)
            logger.error(f"AGENT_STATUS|run_id={run_id}|agent={node_id}|status=error|error={exc}")

        if run:
            run["state"] = state
        return state

    return node_fn


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


def _make_decision_node(condition: str, node_id: str, run_id: str):
    def node_fn(state: dict) -> dict:
        run = LANGGRAPH_RUNS.get(run_id, {})
        if state.get("agent_status", {}).get(node_id) == "completed":
            return state

        state.setdefault("agent_status", {})[node_id] = "in-progress"
        logger.info(f"AGENT_STATUS|run_id={run_id}|agent={node_id}|status=in-progress|condition={condition[:60]}")
        if run:
            run["state"] = state

        try:
            result = eval(condition, {"__builtins__": {}}, {"state": state})  # noqa: S307
            decision = "yes" if result else "no"
        except Exception as exc:
            logger.warning(f"Decision {node_id}: condition eval failed ({exc}) — routing 'no'")
            decision = "no"

        state[f"{node_id}_decision"] = decision
        state["agent_status"][node_id] = "completed"
        logger.info(f"AGENT_STATUS|run_id={run_id}|agent={node_id}|status=completed|decision={decision}")
        if run:
            run["state"] = state
        return state

    return node_fn


def _build_graph_from_edges(builder, nodes_with_ids, edges_raw, node_ids):
    """Wire LangGraph nodes using the canvas edge topology."""
    node_type_map = {n["node_id"]: n.get("node_type") for n in nodes_with_ids}
    node_id_set = set(node_ids)

    edge_map: dict = {}
    has_incoming: set = set()
    for edge in edges_raw:
        src, tgt = edge["source"], edge["target"]
        handle = edge.get("sourceHandle")
        if src in node_id_set and tgt in node_id_set:
            edge_map.setdefault(src, []).append((tgt, handle))
            has_incoming.add(tgt)

    entry = next((nid for nid in node_ids if nid not in has_incoming), node_ids[0])
    builder.set_entry_point(entry)

    for nid in node_ids:
        outgoing = edge_map.get(nid, [])

        if node_type_map.get(nid) == "decision":
            yes_target = next((t for t, h in outgoing if h == "yes"), None)
            no_target  = next((t for t, h in outgoing if h == "no"),  None)
            path_map = {
                "yes": yes_target if yes_target else END,
                "no":  no_target  if no_target  else END,
            }

            def _router(state, _nid=nid):
                return state.get(f"{_nid}_decision", "no")

            builder.add_conditional_edges(nid, _router, path_map)
        else:
            if not outgoing:
                builder.add_edge(nid, END)
            else:
                for tgt, _ in outgoing:
                    builder.add_edge(nid, tgt)


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
        if agent_cfg.get("node_type") in _special_node_types():
            continue
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

    builder = StateGraph(Annotated[dict, _merge_state])
    node_ids: list[str] = []
    edges_raw: list[dict] = data.get("edges", [])

    for agent_cfg in agents_with_ids:
        agent_name = agent_cfg["agent_name"]
        node_id = agent_cfg["node_id"]
        requires_approval = agent_cfg.get("requires_approval", False)

        node_type = agent_cfg.get("node_type")
        if node_type and node_type in _NODE_HANDLER_REGISTRY:
            # Registered special node — dispatch to its factory
            node_fn = _NODE_HANDLER_REGISTRY[node_type](agent_cfg, node_id, run_id)
        else:
            # Regular Python agent
            try:
                agent_instance = _load_agent_instance(agent_name)
            except Exception as exc:
                del LANGGRAPH_RUNS[run_id]
                return jsonify({"error": f"Failed to load agent '{agent_name}': {exc}"}), 500
            node_fn = _make_node(agent_instance, agent_name, node_id, run_id, requires_approval)

        builder.add_node(node_id, node_fn)
        node_ids.append(node_id)

    if edges_raw:
        _build_graph_from_edges(builder, agents_with_ids, edges_raw, node_ids)
    else:
        # Fallback: linear chain (backward compat with spec format)
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
                    "node_type": a.get("node_type"),
                    "output": (
                        state.get(f"{a['node_id']}_output")
                        or state.get(f"{a['agent_name']}_output")
                        or ({"decision": state.get(f"{a['node_id']}_decision")}
                            if a.get("node_type") == "decision" and state.get(f"{a['node_id']}_decision")
                            else None)
                    ),
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
