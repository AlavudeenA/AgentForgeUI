import os
import tempfile
from typing import Optional

from pydantic import BaseModel, Field

from agents.base_agent.Agent import Agent
from github import clone_repo, create_branch
from logger import get_logger
from utilities import resolve_placeholders_input

logger = get_logger()


class GithubCloneandsyncInput(BaseModel):
    repo_url: str = Field(
        ...,
        description="GitHub repository URL (https://github.com/org/repo)",
        json_schema_extra={"ui_type": "textbox"},
    )
    branch_name: str = Field(
        default="main",
        description="Branch to clone",
        json_schema_extra={"ui_type": "textbox"},
    )
    target_dir: str = Field(
        default="",
        description="Local directory to clone into (leave blank for temp dir)",
        json_schema_extra={"ui_type": "textbox"},
    )
    token_type: str = Field(
        default="cloud",
        description="Which GitHub token to use",
        json_schema_extra={"ui_type": "dropdown", "options": ["cloud", "enterprise"]},
    )
    agent_name: Optional[str] = None


class GithubCloneandsyncOutput(BaseModel):
    repo_url: str
    local_path: str
    branch: str
    success: bool
    message: str


class GithubCloneandsyncAgent(Agent):
    def __init__(self):
        super().__init__(
            name="github_cloneandsync_agent",
            role="GitHub Repository Manager",
            goal="Clone and sync GitHub repositories for downstream processing",
            backstory="DevOps specialist that handles repository operations",
        )

    def run(self, state: dict) -> dict:
        input_data = dict(state.get("github_cloneandsync_agent_input", {}))
        for key in list(input_data):
            input_data[key] = resolve_placeholders_input(input_data[key], state)

        repo_url = input_data.get("repo_url", "")
        branch = input_data.get("branch_name", "main")
        target_dir = input_data.get("target_dir", "") or tempfile.mkdtemp(prefix="agforge_")
        token_type = input_data.get("token_type", "cloud")
        token = os.getenv("GITHUB_CLOUD_TOKEN" if token_type == "cloud" else "GITHUB_ENT_TOKEN", "")

        logger.info(f"Cloning {repo_url} → {target_dir}")
        success, result = clone_repo(repo_url, target_dir, token or None)

        state["github_cloneandsync_agent_output"] = {
            "repo_url": repo_url,
            "local_path": target_dir if success else "",
            "branch": branch,
            "success": success,
            "message": result if not success else f"Cloned to {target_dir}",
        }
        return state
