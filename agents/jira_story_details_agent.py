import os
from typing import Optional

import requests
from pydantic import BaseModel, Field

from agents.base_agent.Agent import Agent
from logger import get_logger
from utilities import resolve_placeholders_input

logger = get_logger()


class JiraStoryDetailsInput(BaseModel):
    jira_issue_key: str = Field(
        ...,
        description="JIRA issue key (e.g. PROJ-123)",
        json_schema_extra={"ui_type": "textbox"},
    )
    server_url: str = Field(
        default="",
        description="JIRA server URL (overrides env JIRA_SERVER_URL)",
        json_schema_extra={"ui_type": "textbox"},
    )
    fetch_attachments: str = Field(
        default="no",
        description="Fetch attachments?",
        json_schema_extra={"ui_type": "dropdown", "options": ["yes", "no"]},
    )
    agent_name: Optional[str] = None


class JiraStoryDetailsOutput(BaseModel):
    issue_key: str
    title: str
    description: str
    status: str
    assignee: str
    story_points: Optional[float] = None
    acceptance_criteria: str = ""


class JiraStoryDetailsAgent(Agent):
    def __init__(self):
        super().__init__(
            name="jira_story_details_agent",
            role="JIRA Data Fetcher",
            goal="Retrieve complete JIRA story information",
            backstory="Specialised in fetching and parsing JIRA issue data via the REST API",
        )

    def run(self, state: dict) -> dict:
        input_data = dict(state.get("jira_story_details_agent_input", {}))
        for key in list(input_data):
            input_data[key] = resolve_placeholders_input(input_data[key], state)

        issue_key = input_data.get("jira_issue_key", "")
        server_url = input_data.get("server_url") or os.getenv("JIRA_SERVER_URL", "")
        token = os.getenv("JIRA_TOKEN", "")
        email = os.getenv("JIRA_EMAIL", "")

        logger.info(f"Fetching JIRA story: {issue_key}")

        output: dict = {
            "issue_key": issue_key,
            "title": "",
            "description": "",
            "status": "unknown",
            "assignee": "unassigned",
            "story_points": None,
            "acceptance_criteria": "",
        }

        if server_url and token and email:
            try:
                url = f"{server_url.rstrip('/')}/rest/api/3/issue/{issue_key}"
                resp = requests.get(url, auth=(email, token), timeout=15)
                resp.raise_for_status()
                data = resp.json()
                fields = data.get("fields", {})
                output["title"] = fields.get("summary", "")
                desc = fields.get("description") or {}
                output["description"] = _extract_text(desc)
                output["status"] = (fields.get("status") or {}).get("name", "")
                assignee = fields.get("assignee") or {}
                output["assignee"] = assignee.get("displayName", "unassigned")
                output["story_points"] = fields.get("story_points") or fields.get("customfield_10016")
            except Exception as exc:
                logger.warning(f"JIRA API call failed ({exc}), using placeholder data")
                output["title"] = f"[Simulated] Story {issue_key}"
                output["description"] = "Simulated description — configure JIRA_TOKEN, JIRA_EMAIL, JIRA_SERVER_URL in .env"
        else:
            output["title"] = f"[Simulated] Story {issue_key}"
            output["description"] = "Simulated description — configure JIRA credentials in .env"
            output["status"] = "In Progress"
            output["story_points"] = 5.0

        state["jira_story_details_agent_output"] = output
        return state


def _extract_text(doc) -> str:
    if isinstance(doc, str):
        return doc
    if isinstance(doc, dict):
        parts = []
        for block in doc.get("content", []):
            parts.append(_extract_text(block))
        return " ".join(p for p in parts if p)
    return ""
