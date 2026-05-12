import time

from pydantic import BaseModel, Field

from agents.base_agent.Agent import Agent
from logger import get_logger

logger = get_logger()


class DivisionInput(BaseModel):
    operand_a: str = Field(..., description="Numerator", json_schema_extra={"ui_type": "textbox"})
    operand_b: str = Field(..., description="Denominator", json_schema_extra={"ui_type": "textbox"})


class DivisionOutput(BaseModel):
    result: float


class DivisionAgent(Agent):
    def __init__(self):
        super().__init__(name="division_agent", role="Math Agent", goal="Divide two numbers", backstory="Simple arithmetic agent")

    def run(self, state: dict) -> dict:
        inputs = state.get("division_agent_input", {})
        a = float(inputs.get("operand_a", 0))
        b = float(inputs.get("operand_b", 1))
        if b == 0:
            raise ValueError("Division by zero")
        time.sleep(5)
        result = a / b
        logger.info(f"DivisionAgent: {a} / {b} = {result}")
        state["division_agent_output"] = {"result": result}
        return state
