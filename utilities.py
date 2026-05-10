import re
import json
import ast
from logger import get_logger

logger = get_logger()


def _parse_pseudo_json_string(s: str):
    try:
        return json.loads(s)
    except Exception:
        pass
    try:
        return ast.literal_eval(s)
    except Exception:
        return s


def _navigate_state(data, keys: list):
    current = data
    for key in keys:
        if isinstance(current, dict):
            if key not in current:
                return None, False
            current = current[key]
        elif isinstance(current, list):
            found = False
            for item in current:
                if isinstance(item, dict) and key in item:
                    current = item[key]
                    found = True
                    break
            if not found:
                return None, False
        elif isinstance(current, str):
            parsed = _parse_pseudo_json_string(current)
            if isinstance(parsed, dict) and key in parsed:
                current = parsed[key]
            else:
                return None, False
        else:
            return None, False
    return current, True


_PLACEHOLDER_RE = re.compile(r"\{state\['[^']+'\](?:\['[^']+'\])*\}")


def resolve_placeholders_input(value, state: dict):
    """Replace {state['key']['nested']} patterns with actual state values."""
    if isinstance(value, list):
        return [resolve_placeholders_input(v, state) for v in value]
    if isinstance(value, dict):
        return {k: resolve_placeholders_input(v, state) for k, v in value.items()}
    if not isinstance(value, str):
        return value

    matches = list(_PLACEHOLDER_RE.finditer(value))
    if not matches:
        return value

    result = value
    for match in matches:
        placeholder = match.group(0)
        keys = re.findall(r"\['([^']+)'\]", placeholder)
        resolved, found = _navigate_state(state, keys)

        if found:
            if value.strip() == placeholder:
                return resolved
            result = result.replace(placeholder, "" if resolved is None else str(resolved))
        else:
            logger.warning(f"Placeholder {placeholder} not found in state")
            result = result.replace(placeholder, "")

    return result
