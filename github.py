import os
import subprocess
from urllib.parse import urlparse

from logger import get_logger

logger = get_logger()


def _inject_token(url: str, token: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{token}@{parsed.netloc}{parsed.path}"


def clone_repo(url: str, target_dir: str, token: str = None) -> tuple[bool, str]:
    if token:
        url = _inject_token(url, token)
    try:
        r = subprocess.run(["git", "clone", url, target_dir], capture_output=True, text=True, timeout=180)
        if r.returncode != 0:
            logger.error(f"Clone failed: {r.stderr}")
            return False, r.stderr
        return True, target_dir
    except Exception as exc:
        logger.error(f"Clone exception: {exc}")
        return False, str(exc)


def create_branch(repo_dir: str, branch_name: str, base_branch: str = "main") -> tuple[bool, str]:
    try:
        subprocess.run(["git", "-C", repo_dir, "fetch", "origin"], capture_output=True, check=True)
        subprocess.run(["git", "-C", repo_dir, "checkout", base_branch], capture_output=True, check=True)
        subprocess.run(["git", "-C", repo_dir, "pull"], capture_output=True, check=True)
        subprocess.run(["git", "-C", repo_dir, "checkout", "-b", branch_name], capture_output=True, check=True)
        return True, branch_name
    except subprocess.CalledProcessError as exc:
        logger.error(f"Branch creation failed: {exc}")
        return False, str(exc)


def push_branch(repo_dir: str, branch_name: str) -> tuple[bool, str]:
    try:
        r = subprocess.run(
            ["git", "-C", repo_dir, "push", "--set-upstream", "origin", branch_name],
            capture_output=True, text=True, check=True,
        )
        return True, r.stdout
    except subprocess.CalledProcessError as exc:
        return False, exc.stderr


def create_pull_request(repo: str, title: str, body: str, head_branch: str, base_branch: str = "main", token: str = None) -> tuple[bool, str]:
    import requests

    headers = {"Authorization": f"token {token}", "Content-Type": "application/json"}
    payload = {"title": title, "body": body, "head": head_branch, "base": base_branch}
    resp = requests.post(f"https://api.github.com/repos/{repo}/pulls", json=payload, headers=headers, timeout=30)
    if resp.status_code == 201:
        return True, resp.json().get("html_url", "")
    logger.error(f"PR creation failed: {resp.text}")
    return False, resp.text
