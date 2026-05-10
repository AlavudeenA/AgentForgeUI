import os
from typing import Optional

from pydantic import BaseModel, Field

from agents.base_agent.Agent import Agent
from github import create_pull_request, push_branch
from logger import get_logger
from utilities import resolve_placeholders_input

logger = get_logger()


class GithubCreatepullRequestInput(BaseModel):
    repo: str = Field(
        ...,
        description="GitHub repo in org/name format (e.g. myorg/myrepo)",
        json_schema_extra={"ui_type": "textbox"},
    )
    head_branch: str = Field(
        ...,
        description="Source branch for the PR",
        json_schema_extra={"ui_type": "textbox"},
    )
    base_branch: str = Field(
        default="main",
        description="Target branch for the PR",
        json_schema_extra={"ui_type": "textbox"},
    )
    pr_title: str = Field(
        ...,
        description="Pull request title",
        json_schema_extra={"ui_type": "textbox"},
    )
    pr_body: str = Field(
        default="",
        description="Pull request description / body",
        json_schema_extra={"ui_type": "textarea"},
    )
    local_repo_path: str = Field(
        default="",
        description="Local path to push before creating PR (leave blank to skip push)",
        json_schema_extra={"ui_type": "textbox"},
    )
    token_type: str = Field(
        default="cloud",
        description="Which GitHub token to use",
        json_schema_extra={"ui_type": "dropdown", "options": ["cloud", "enterprise"]},
    )
    agent_name: Optional[str] = None


class GithubCreatepullRequestOutput(BaseModel):
    pr_url: str
    success: bool
    message: str


class GithubCreatepullRequestAgent(Agent):
    def __init__(self):
        super().__init__(
            name="github_createpullRequest_agent",
            role="GitHub PR Creator",
            goal="Open a pull request on GitHub after pushing changes",
            backstory="CI/CD automation agent specialised in GitHub workflows",
        )

    def run(self, state: dict) -> dict:
        input_data = dict(state.get("github_createpullRequest_agent_input", {}))
        for key in list(input_data):
            input_data[key] = resolve_placeholders_input(input_data[key], state)

        repo = input_data.get("repo", "")
        head_branch = input_data.get("head_branch", "")
        base_branch = input_data.get("base_branch", "main")
        pr_title = input_data.get("pr_title", "Automated PR")
        pr_body = input_data.get("pr_body", "")
        local_path = input_data.get("local_repo_path", "")
        token_type = input_data.get("token_type", "cloud")
        token = os.getenv("GITHUB_CLOUD_TOKEN" if token_type == "cloud" else "GITHUB_ENT_TOKEN", "")

        if local_path:
            push_ok, push_msg = push_branch(local_path, head_branch)
            if not push_ok:
                logger.warning(f"Push failed: {push_msg}")

        logger.info(f"Creating PR: {repo} {head_branch} → {base_branch}")
        success, result = create_pull_request(repo, pr_title, pr_body, head_branch, base_branch, token or None)

        state["github_createpullRequest_agent_output"] = {
            "pr_url": result if success else "",
            "success": success,
            "message": result,
        }
        return state
