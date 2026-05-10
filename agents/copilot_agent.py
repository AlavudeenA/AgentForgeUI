import os
from typing import Optional

import requests
from pydantic import BaseModel, Field

from agents.base_agent.Agent import Agent
from logger import get_logger
from utilities import resolve_placeholders_input

logger = get_logger()


class CopilotInput(BaseModel):
    prompt: str = Field(
        ...,
        description="The coding task or requirement description",
        json_schema_extra={"ui_type": "textarea"},
    )
    language: str = Field(
        default="python",
        description="Target programming language",
        json_schema_extra={"ui_type": "dropdown", "options": ["python", "javascript", "typescript", "java", "go", "rust", "csharp"]},
    )
    context: str = Field(
        default="",
        description="Additional context (existing code, constraints, etc.)",
        json_schema_extra={"ui_type": "textarea"},
    )
    model: str = Field(
        default="gpt-4o",
        description="LLM model to use",
        json_schema_extra={"ui_type": "textbox"},
    )
    agent_name: Optional[str] = None


class CopilotOutput(BaseModel):
    generated_code: str
    explanation: str
    language: str
    tokens_used: int = 0


class CopilotAgent(Agent):
    def __init__(self):
        super().__init__(
            name="copilot_agent",
            role="AI Code Generator",
            goal="Produce high-quality implementation code from natural-language requirements",
            backstory="Expert software engineer backed by a large language model",
        )

    def run(self, state: dict) -> dict:
        input_data = dict(state.get("copilot_agent_input", {}))
        for key in list(input_data):
            input_data[key] = resolve_placeholders_input(input_data[key], state)

        prompt = input_data.get("prompt", "")
        language = input_data.get("language", "python")
        context = input_data.get("context", "")
        model = input_data.get("model", "gpt-4o")

        logger.info(f"CopilotAgent: generating {language} code")

        llm_base = os.getenv("OPENAI_API_BASE", "http://localhost:5050")
        api_key = os.getenv("OPENAI_API_KEY", "none")

        system_msg = (
            f"You are an expert {language} developer. "
            "Return ONLY the code without markdown fences, followed by '---EXPLANATION---' and a brief explanation."
        )
        user_msg = f"{prompt}\n\nContext:\n{context}" if context else prompt

        generated_code = ""
        explanation = ""
        tokens_used = 0

        try:
            resp = requests.post(
                f"{llm_base.rstrip('/')}/v1/chat/completions",
                json={"model": model, "messages": [{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}]},
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            tokens_used = data.get("usage", {}).get("total_tokens", 0)
            if "---EXPLANATION---" in content:
                parts = content.split("---EXPLANATION---", 1)
                generated_code = parts[0].strip()
                explanation = parts[1].strip()
            else:
                generated_code = content.strip()
                explanation = "Code generated successfully."
        except Exception as exc:
            logger.warning(f"LLM call failed ({exc}), using placeholder output")
            generated_code = f"# Generated {language} code placeholder\n# Prompt: {prompt[:100]}\ndef main():\n    pass"
            explanation = "LLM endpoint not available — configure OPENAI_API_BASE in .env"

        state["copilot_agent_output"] = {
            "generated_code": generated_code,
            "explanation": explanation,
            "language": language,
            "tokens_used": tokens_used,
        }
        return state
