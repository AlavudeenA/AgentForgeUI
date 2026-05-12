import time

from pydantic import BaseModel, Field

from agents.base_agent.Agent import Agent
from logger import get_logger

logger = get_logger()


class AggregateResultsInput(BaseModel):
    subtraction_result: str = Field(..., description="Result from subtraction", json_schema_extra={"ui_type": "textbox"})
    multiplication_result: str = Field(..., description="Result from multiplication", json_schema_extra={"ui_type": "textbox"})
    division_result: str = Field(..., description="Result from division", json_schema_extra={"ui_type": "textbox"})


class AggregateResultsOutput(BaseModel):
    total: float


class AggregateResultsAgent(Agent):
    def __init__(self):
        super().__init__(
            name="aggregate_results_agent",
            role="Math Aggregator",
            goal="Sum results from parallel math agents",
            backstory="Collects outputs from subtraction, multiplication and division agents and returns their total",
        )

    def run(self, state: dict) -> dict:
        inputs = state.get("aggregate_results_agent_input", {})
        sub = float(inputs.get("subtraction_result", 0))
        mul = float(inputs.get("multiplication_result", 0))
        div = float(inputs.get("division_result", 0))
        time.sleep(5)
        total = sub + mul + div
        logger.info(f"AggregateResultsAgent: {sub} + {mul} + {div} = {total}")
        state["aggregate_results_agent_output"] = {"total": total}
        return state
