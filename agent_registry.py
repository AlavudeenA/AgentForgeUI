import importlib.util
import inspect
import os

from pydantic import BaseModel

from agent_descriptions import AGENT_DESCRIPTIONS
from logger import get_logger

logger = get_logger()

_AGENTS_DIR = os.path.join(os.path.dirname(__file__), "agents")


class AgentRegistry:
    AGENTS: list[dict] = []

    @classmethod
    def load_agents(cls) -> list[dict]:
        cls.AGENTS = []

        for filename in sorted(os.listdir(_AGENTS_DIR)):
            if not filename.endswith(".py") or filename.startswith("__"):
                continue
            if filename == "base_agent":
                continue

            agent_key = filename[:-3]
            filepath = os.path.join(_AGENTS_DIR, filename)

            try:
                spec = importlib.util.spec_from_file_location(agent_key, filepath)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)

                input_cls = output_cls = None
                for name in dir(module):
                    obj = getattr(module, name)
                    if not inspect.isclass(obj) or not issubclass(obj, BaseModel) or obj is BaseModel:
                        continue
                    if name.endswith("Input"):
                        input_cls = obj
                    elif name.endswith("Output"):
                        output_cls = obj

                if input_cls is None or output_cls is None:
                    logger.warning(f"Skipping {filename}: missing Input or Output class")
                    continue

                input_format: dict = {}
                input_order: list[str] = []

                for field_name, field_info in input_cls.model_fields.items():
                    extra = field_info.json_schema_extra or {}
                    ui_type = extra.get("ui_type")
                    if ui_type is None:
                        continue
                    default = field_info.default
                    input_format[field_name] = {
                        "ui_type": ui_type,
                        "description": field_info.description or "",
                        "default": "" if default is None or str(default) == "PydanticUndefined" else default,
                        "options": extra.get("options", []),
                        "depends_on": extra.get("depends_on"),
                        "required": field_info.is_required(),
                    }
                    input_order.append(field_name)

                output_format: dict = {}
                for field_name, field_info in output_cls.model_fields.items():
                    ann = field_info.annotation
                    output_format[field_name] = str(ann) if ann else "str"

                cls.AGENTS.append(
                    {
                        "name": agent_key,
                        "input_format": input_format,
                        "output_format": output_format,
                        "input_order": input_order,
                        "input_class": input_cls.__name__,
                        "output_class": output_cls.__name__ if output_cls else None,
                        "description": AGENT_DESCRIPTIONS.get(agent_key, f"Agent: {agent_key}"),
                    }
                )
                logger.info(f"Registered agent: {agent_key}")

            except Exception as exc:
                logger.error(f"Failed to load agent {filename}: {exc}")

        return cls.AGENTS


AgentRegistry.load_agents()
