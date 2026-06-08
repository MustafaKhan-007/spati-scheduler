from functools import wraps
from datetime import date, timedelta, datetime

from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from flask_login import login_required, current_user

from models import db, User, Branch, Availability, Shift

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
SLOTS = [
    {"key": "morning", "label": "Morning", "time": "06:00–14:00"},
    {"key": "evening", "label": "Evening", "time": "14:00–22:00"},
    {"key": "night",   "label": "Night",   "time": "22:00–06:00"},
]


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if current_user.role != "admin":
            if request.is_json or request.content_type == "application/json":
                return jsonify({"error": "Forbidden — admin only"}), 403
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated


def get_week_start() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


@admin_bp.route("/dashboard")
@login_required
@admin_required
def dashboard():
    week_start = get_week_start()

    employees = User.query.filter_by(role="employee").order_by(User.full_name).all()
    branches  = Branch.query.order_by(Branch.name).all()

    days = [
        {
            "index": i,
            "name":  DAY_NAMES[i],
            "date":  (week_start + timedelta(days=i)).strftime("%d.%m"),
        }
        for i in range(7)
    ]

    return render_template(
        "admin_dashboard.html",
        employees=employees,
        branches=branches,
        week_start=week_start.strftime("%Y-%m-%d"),
        week_start_display=week_start.strftime("%d.%m.%Y"),
        days=days,
        slots=SLOTS,
    )


# ── Branch schedule (all assigned names for a branch/week) ──────────────────

@admin_bp.route("/branch/<int:branch_id>/schedule", methods=["GET"])
@login_required
@admin_required
def get_branch_schedule(branch_id):
    week_start = get_week_start()

    shift_rows = (
        Shift.query
        .filter_by(branch_id=branch_id, week_start=week_start)
        .all()
    )

    schedule = {}
    for s in shift_rows:
        key = f"{s.day_of_week}_{s.slot}"
        schedule.setdefault(key, [])
        schedule[key].append({
            "user_id":      s.user_id,
            "full_name":    s.user.full_name    if s.user else "",
            "accent_color": s.user.accent_color if s.user and s.user.accent_color else "",
        })

    return jsonify({"schedule": schedule})


# ── Employee availability (with cross-branch context) ───────────────────────

@admin_bp.route("/availability/<int:user_id>", methods=["GET"])
@login_required
@admin_required
def get_availability(user_id):
    week_start = get_week_start()
    branch_id  = request.args.get("branch_id", type=int)

    avail_rows = Availability.query.filter_by(
        user_id=user_id,
        week_start=week_start,
    ).all()

    shift_rows = Shift.query.filter_by(
        user_id=user_id,
        week_start=week_start,
    ).all()

    availability = {f"{r.day_of_week}_{r.slot}": r.is_available for r in avail_rows}

    shifts = {
        f"{s.day_of_week}_{s.slot}": {
            "id":             s.id,
            "branch_id":      s.branch_id,
            "branch_name":    s.branch.name if s.branch else "",
            "at_this_branch": (s.branch_id == branch_id) if branch_id else False,
        }
        for s in shift_rows
    }

    return jsonify({"availability": availability, "shifts": shifts})


# ── Assign / remove a shift ──────────────────────────────────────────────────

@admin_bp.route("/assign", methods=["POST"])
@login_required
@admin_required
def assign_shift():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data"}), 400

    user_id        = data.get("user_id")
    day_of_week    = data.get("day_of_week")
    slot           = data.get("slot")
    branch_id      = data.get("branch_id")
    week_start_str = data.get("week_start")

    if user_id is None or day_of_week is None or not slot or branch_id is None or not week_start_str:
        return jsonify({"error": "Missing required fields"}), 400

    try:
        week_start = datetime.strptime(week_start_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Invalid week_start format"}), 400

    # Check for any existing shift for this employee in this slot (any branch)
    any_existing = Shift.query.filter_by(
        user_id=user_id,
        week_start=week_start,
        day_of_week=day_of_week,
        slot=slot,
    ).first()

    if any_existing:
        if any_existing.branch_id == branch_id:
            # Same branch — toggle off
            db.session.delete(any_existing)
            db.session.commit()
            return jsonify({"status": "removed"})
        else:
            # Already assigned at a different branch — block
            return jsonify({
                "error":       "conflict",
                "branch_name": any_existing.branch.name if any_existing.branch else "another branch",
            }), 409

    branch = db.session.get(Branch, branch_id)
    if not branch:
        return jsonify({"error": "Branch not found"}), 404

    shift = Shift(
        user_id=user_id,
        branch_id=branch_id,
        week_start=week_start,
        day_of_week=day_of_week,
        slot=slot,
    )
    db.session.add(shift)
    db.session.commit()

    return jsonify({"status": "assigned", "branch_name": branch.name})
