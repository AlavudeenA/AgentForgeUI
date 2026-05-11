from pydantic import BaseModel, Field

from agents.base_agent.Agent import Agent
from logger import get_logger

logger = get_logger()


class AdditionInput(BaseModel):
    operand_a: str = Field(..., description="First number", json_schema_extra={"ui_type": "textbox"})
    operand_b: str = Field(..., description="Second number", json_schema_extra={"ui_type": "textbox"})


class AdditionOutput(BaseModel):
    result: float


class AdditionAgent(Agent):
    def __init__(self):
        super().__init__(name="addition_agent", role="Math Agent", goal="Add two numbers", backstory="Simple arithmetic agent")

    def run(self, state: dict) -> dict:
        inputs = state.get("addition_agent_input", {})
        a = float(inputs.get("operand_a", 0))
        b = float(inputs.get("operand_b", 0))
        result = a + b
        logger.info(f"AdditionAgent: {a} + {b} = {result}")
        state["addition_agent_output"] = {"result": result}
        return state
