from flask import Blueprint, jsonify

tachyon_bp = Blueprint("tachyon", __name__, url_prefix="/tachyon")


@tachyon_bp.route("/ping", methods=["GET"])
def ping():
    return jsonify({"status": "ok", "service": "tachyon"})
