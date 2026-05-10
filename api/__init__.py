import os

from flask import Flask
from flask_cors import CORS


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)
    CORS(app)

    base = os.path.dirname(os.path.dirname(__file__))
    app.config["UPLOAD_FOLDER"] = os.path.join(base, "uploaded_files")
    app.config["WORKFLOW_JSON_FOLDER"] = os.path.join(base, "workflow_jsons")
    app.config["LOG_FILE"] = os.path.join(base, "logs", "app.log")
    app.config["WEBUI_DIST"] = os.path.join(base, "webui", "dist")

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["WORKFLOW_JSON_FOLDER"], exist_ok=True)
    os.makedirs(os.path.join(base, "logs"), exist_ok=True)

    from api.routes.agents import agents_bp
    from api.routes.files import files_bp
    from api.routes.github_routes import github_bp
    from api.routes.tachyon import tachyon_bp
    from api.routes.workflows import workflows_bp

    app.register_blueprint(agents_bp)
    app.register_blueprint(workflows_bp)
    app.register_blueprint(files_bp)
    app.register_blueprint(github_bp)
    app.register_blueprint(tachyon_bp)

    return app
