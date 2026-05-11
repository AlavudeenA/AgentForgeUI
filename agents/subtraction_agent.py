import time

from pydantic import BaseModel, Field

from agents.base_agent.Agent import Agent
from logger import get_logger

logger = get_logger()


class SubtractionInput(BaseModel):
    operand_a: str = Field(
        ...,
        description="First number",
        json_schema_extra={"ui_type": "textbox"},
    )
    operand_b: str = Field(
        ...,
        description="Second number",
        json_schema_extra={"ui_type": "textbox"},
    )


class SubtractionOutput(BaseModel):
    result: float


class SubtractionAgent(Agent):
    def __init__(self):
        super().__init__(
            name="subtraction_agent",
            role="Math Agent",
            goal="Subtract two numbers",
            backstory="Simple arithmetic agent",
        )

    def run(self, state: dict) -> dict:
        inputs = state.get("subtraction_agent_input", {})
        a = float(inputs.get("operand_a", 0))
        b = float(inputs.get("operand_b", 0))

        logger.info(f"SubtractionAgent: waiting 5s before computing {a} - {b}")
        time.sleep(5)

        result = a - b
        logger.info(f"SubtractionAgent: result = {result}")

        state["subtraction_agent_output"] = {"result": result}
        return state
