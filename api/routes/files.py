import os

from flask import Blueprint, current_app, jsonify, request
from werkzeug.utils import secure_filename

files_bp = Blueprint("files", __name__)

ALLOWED_EXTENSIONS = {"txt", "pdf", "png", "jpg", "jpeg", "md", "json", "yaml", "yml", "py", "js", "ts"}


def _allowed(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@files_bp.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file in request"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "Empty filename"}), 400
    if not _allowed(f.filename):
        return jsonify({"error": "File type not allowed"}), 400

    filename = secure_filename(f.filename)
    dest = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
    f.save(dest)
    return jsonify({"status": "ok", "filename": filename, "path": dest})


@files_bp.route("/uploaded_files", methods=["GET"])
def list_files():
    folder = current_app.config["UPLOAD_FOLDER"]
    files = os.listdir(folder) if os.path.isdir(folder) else []
    return jsonify(files)
