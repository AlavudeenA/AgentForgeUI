class Agent:
    """Minimal base class for all workflow agents."""

    def __init__(self, name: str, role: str, goal: str, backstory: str):
        self.name = name
        self.role = role
        self.goal = goal
        self.backstory = backstory

    def run(self, state: dict) -> dict:
        raise NotImplementedError("Subclasses must implement run(state)")
