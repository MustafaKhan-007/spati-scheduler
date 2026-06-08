from functools import wraps
from datetime import date, timedelta

from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from flask_login import login_required, current_user

import re

from models import db, Availability

employee_bp = Blueprint("employee", __name__, url_prefix="/employee")

DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
SLOTS = [
    {"key": "morning", "label": "Morning", "time": "06:00–14:00"},
    {"key": "evening", "label": "Evening", "time": "14:00–22:00"},
    {"key": "night",   "label": "Night",   "time": "22:00–06:00"},
]


def employee_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if current_user.role != "employee":
            if request.is_json or request.path.endswith("/availability"):
                return jsonify({"error": "Forbidden — employee only"}), 403
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated


def get_week_start() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


@employee_bp.route("/dashboard")
@login_required
@employee_required
def dashboard():
    week_start = get_week_start()
    week_end = week_start + timedelta(days=6)

    days = [
        {
            "index": i,
            "name": DAY_NAMES[i],
            "date": (week_start + timedelta(days=i)).strftime("%d.%m"),
        }
        for i in range(7)
    ]

    return render_template(
        "employee_dashboard.html",
        week_start=week_start.strftime("%Y-%m-%d"),
        week_start_display=week_start.strftime("%d.%m.%Y"),
        week_end_display=week_end.strftime("%d.%m.%Y"),
        days=days,
        slots=SLOTS,
    )


@employee_bp.route("/availability", methods=["GET"])
@login_required
@employee_required
def get_availability():
    week_start = get_week_start()
    rows = Availability.query.filter_by(
        user_id=current_user.id,
        week_start=week_start,
    ).all()

    data = {f"{r.day_of_week}_{r.slot}": r.is_available for r in rows}
    return jsonify(data)


@employee_bp.route("/availability", methods=["POST"])
@login_required
@employee_required
def save_availability():
    payload = request.get_json()
    if not payload or "slots" not in payload:
        return jsonify({"error": "Invalid payload"}), 400

    week_start = get_week_start()

    Availability.query.filter_by(
        user_id=current_user.id,
        week_start=week_start,
    ).delete()

    for item in payload["slots"]:
        db.session.add(
            Availability(
                user_id=current_user.id,
                week_start=week_start,
                day_of_week=item["day"],
                slot=item["slot"],
                is_available=bool(item["available"]),
            )
        )

    db.session.commit()
    return jsonify({"status": "ok"})


# ── Accent colour ────────────────────────────────────────────────────────────

_HEX_RE = re.compile(r'^#[0-9a-fA-F]{6}$')

# Colours to reject: too close to the system's green / red / white / black
_BLOCKED = {"#000000", "#ffffff", "#2d6a4f", "#9b2226",
            "#00ff00", "#008000", "#ff0000", "#dc2626"}


@employee_bp.route("/accent-color", methods=["GET", "POST"])
@login_required
@employee_required
def handle_accent_color():
    if request.method == "GET":
        return jsonify({"accent_color": current_user.accent_color or ""})

    data  = request.get_json() or {}
    color = data.get("color", "").strip().lower()

    if not _HEX_RE.match(color):
        return jsonify({"error": "Invalid colour format"}), 400
    if color in _BLOCKED:
        return jsonify({"error": "Colour not allowed"}), 400

    current_user.accent_color = color
    db.session.commit()
    return jsonify({"status": "ok", "accent_color": color})
