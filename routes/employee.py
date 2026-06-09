from functools import wraps
from datetime import date, timedelta, datetime
from zoneinfo import ZoneInfo

_BERLIN = ZoneInfo("Europe/Berlin")

from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from flask_login import login_required, current_user

import re

from models import db, User, Availability
from translations import get_t

employee_bp = Blueprint("employee", __name__, url_prefix="/employee")


def employee_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if current_user.role != "employee":
            if request.is_json or request.path.endswith("/availability"):
                return jsonify({"error": "Forbidden — employee only"}), 403
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated


_SLOTS = ["morning", "evening", "night"]


def get_week_start() -> date:
    today = datetime.now(_BERLIN).date()
    return today - timedelta(days=today.weekday())


@employee_bp.route("/dashboard")
@login_required
@employee_required
def dashboard():
    t          = get_t()
    week_start = get_week_start()
    week_end   = week_start + timedelta(days=6)

    day_names = t["days"]
    slots = [
        {"key": "night",   "label": t["slot_night"],   "time": "00:00–08:00"},
        {"key": "morning", "label": t["slot_morning"], "time": "08:00–16:00"},
        {"key": "evening", "label": t["slot_evening"], "time": "16:00–00:00"},
    ]

    days = [
        {
            "index": i,
            "name":  day_names[i],
            "date":  (week_start + timedelta(days=i)).strftime("%d.%m"),
        }
        for i in range(7)
    ]

    return render_template(
        "employee_dashboard.html",
        week_start=week_start.strftime("%Y-%m-%d"),
        week_start_display=week_start.strftime("%d.%m.%Y"),
        week_end_display=week_end.strftime("%d.%m.%Y"),
        days=days,
        slots=slots,
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

    # Pre-fill every slot as unavailable (False) — only override with explicit records
    data = {f"{day}_{slot}": False for day in range(7) for slot in _SLOTS}
    for r in rows:
        data[f"{r.day_of_week}_{r.slot}"] = r.is_available

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


@employee_bp.route("/change-password", methods=["POST"])
@login_required
@employee_required
def change_password():
    from werkzeug.security import check_password_hash, generate_password_hash
    data = request.get_json() or {}

    current_pw  = data.get("current_password", "")
    new_pw      = data.get("new_password", "")
    confirm_pw  = data.get("confirm_password", "")

    if not check_password_hash(current_user.password_hash, current_pw):
        return jsonify({"error": "wrong_current"}), 400

    if len(new_pw) < 6:
        return jsonify({"error": "too_short"}), 400

    if new_pw != confirm_pw:
        return jsonify({"error": "mismatch"}), 400

    current_user.password_hash = generate_password_hash(new_pw)
    db.session.commit()
    return jsonify({"status": "ok"})
