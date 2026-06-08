from flask import Blueprint, session, redirect, request, url_for
from translations import SUPPORTED

lang_bp = Blueprint("lang", __name__)


@lang_bp.route("/lang/<code>")
def set_language(code):
    if code in SUPPORTED:
        session["lang"] = code
    # Redirect back to the page the user came from, or to login as fallback
    return redirect(request.referrer or url_for("auth.login"))
