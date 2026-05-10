from agent_registry import AgentRegistry
from logger import get_logger

logger = get_logger()


def parse_dynamic_agent_input_format(agent_config: dict, state: dict) -> dict:
    """Validate and store raw agent inputs into state under {node_id}_input key."""
    agent_name: str = agent_config.get("agent_name", "")
    node_id: str = agent_config.get("node_id", agent_name)
    inputs: dict = agent_config.get("inputs", {})

    agent_meta = next((a for a in AgentRegistry.AGENTS if a["name"] == agent_name), None)
    if agent_meta is None:
        logger.warning(f"Agent '{agent_name}' not found in registry — storing inputs as-is")
        state[f"{node_id}_input"] = inputs
        return state

    merged: dict = {}
    for field_name, field_meta in agent_meta["input_format"].items():
        if field_name in inputs:
            merged[field_name] = inputs[field_name]
        elif field_meta.get("default") not in (None, ""):
            merged[field_name] = field_meta["default"]
        else:
            merged[field_name] = ""

    for key, val in inputs.items():
        if key not in merged:
            merged[key] = val

    # Spec: agent_name is always injected by runtime, set to node_id
    merged["agent_name"] = node_id

    state[f"{node_id}_input"] = merged
    return state
