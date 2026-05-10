import json
import os

from flask import Blueprint, current_app, jsonify

from agent_registry import AgentRegistry

agents_bp = Blueprint("agents", __name__)


@agents_bp.route("/get_agents", methods=["GET"])
def get_agents():
    return jsonify(AgentRegistry.AGENTS)


@agents_bp.route("/refresh_agents_metadata", methods=["POST"])
def refresh_agents_metadata():
    AgentRegistry.load_agents()

    llm_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "LLMWorkflows")
    os.makedirs(llm_dir, exist_ok=True)

    metadata = [
        {
            "name": a["name"],
            "description": a["description"],
            "inputs": a["input_order"],
            "outputs": list(a["output_format"].keys()),
        }
        for a in AgentRegistry.AGENTS
    ]

    with open(os.path.join(llm_dir, "agents_metadata.txt"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return jsonify({"status": "ok", "agents_count": len(AgentRegistry.AGENTS)})
