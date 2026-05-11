import time

from pydantic import BaseModel, Field

from agents.base_agent.Agent import Agent
from logger import get_logger

logger = get_logger()


class MultiplicationInput(BaseModel):
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


class MultiplicationOutput(BaseModel):
    result: float


class MultiplicationAgent(Agent):
    def __init__(self):
        super().__init__(
            name="multiplication_agent",
            role="Math Agent",
            goal="Multiply two numbers",
            backstory="Simple arithmetic agent",
        )

    def run(self, state: dict) -> dict:
        inputs = state.get("multiplication_agent_input", {})
        a = float(inputs.get("operand_a", 0))
        b = float(inputs.get("operand_b", 0))

        logger.info(f"MultiplicationAgent: waiting 5s before computing {a} * {b}")
        time.sleep(5)

        result = a * b
        logger.info(f"MultiplicationAgent: result = {result}")

        state["multiplication_agent_output"] = {"result": result}
        return state
