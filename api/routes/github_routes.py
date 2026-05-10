import os

from flask import Blueprint, jsonify, request

import github as gh

github_bp = Blueprint("github", __name__, url_prefix="/github")


@github_bp.route("/clone", methods=["POST"])
def clone():
    data = request.json or {}
    url = data.get("repo_url", "")
    target = data.get("target_dir", "")
    token_type = data.get("token_type", "cloud")
    token = os.getenv("GITHUB_CLOUD_TOKEN" if token_type == "cloud" else "GITHUB_ENT_TOKEN", "")
    ok, result = gh.clone_repo(url, target, token or None)
    return jsonify({"success": ok, "result": result})


@github_bp.route("/create_branch", methods=["POST"])
def create_branch():
    data = request.json or {}
    ok, result = gh.create_branch(data.get("repo_dir", ""), data.get("branch_name", ""), data.get("base_branch", "main"))
    return jsonify({"success": ok, "result": result})


@github_bp.route("/create_pr", methods=["POST"])
def create_pr():
    data = request.json or {}
    token_type = data.get("token_type", "cloud")
    token = os.getenv("GITHUB_CLOUD_TOKEN" if token_type == "cloud" else "GITHUB_ENT_TOKEN", "")
    ok, result = gh.create_pull_request(
        data.get("repo", ""),
        data.get("title", "Automated PR"),
        data.get("body", ""),
        data.get("head_branch", ""),
        data.get("base_branch", "main"),
        token or None,
    )
    return jsonify({"success": ok, "pr_url": result if ok else "", "error": result if not ok else ""})
