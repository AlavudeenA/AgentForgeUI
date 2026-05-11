from pydantic import BaseModel, Field

from agents.base_agent.Agent import Agent
from logger import get_logger

logger = get_logger()


class DisplayOutputInput(BaseModel):
    value: str = Field(
        ...,
        description="Value to display as the final workflow output",
        json_schema_extra={"ui_type": "textbox"},
    )


class DisplayOutputOutput(BaseModel):
    result: str


class DisplayOutputAgent(Agent):
    def __init__(self):
        super().__init__(
            name="display_output_agent",
            role="Output Display",
            goal="Surface a value as the final workflow result",
            backstory="Pass-through agent that displays a mapped value as the workflow output",
        )

    def run(self, state: dict) -> dict:
        inputs = state.get("display_output_agent_input", {})
        value = str(inputs.get("value", ""))
        logger.info(f"DisplayOutputAgent: result = {value}")
        state["display_output_agent_output"] = {"result": value}
        return state
