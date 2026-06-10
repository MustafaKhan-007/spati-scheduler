import os
from flask import Flask
from flask_login import LoginManager
from models import db, User

# Run seed.py once after first deploy:
# Open Render shell → python seed.py


def create_app():
    app = Flask(__name__)

    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key-change-in-prod")

    database_url = os.getenv("DATABASE_URL", "sqlite:///spati.db")
    # SQLAlchemy requires postgresql:// not postgres:// (Render.com quirk)
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # CSRF protection is disabled for this prototype.
    # WARNING: Enable Flask-WTF CSRF in any production deployment.
    app.config["WTF_CSRF_ENABLED"] = False

    db.init_app(app)

    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"
    login_manager.login_message = "Please log in to continue."
    login_manager.login_message_category = "error"

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    from routes.auth import auth_bp
    from routes.employee import employee_bp
    from routes.admin import admin_bp
    from routes.lang import lang_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(employee_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(lang_bp)

    # Inject translations + current language into every template context
    from flask import session as _session
    from translations import TRANSLATIONS

    @app.context_processor
    def inject_i18n():
        lang = _session.get("lang", "en")
        return {
            "t":            TRANSLATIONS.get(lang, TRANSLATIONS["en"]),
            "current_lang": lang,
        }

    with app.app_context():
        db.create_all()
        _ensure_schema()
        _ensure_branches()
        _backfill_plain_passwords()

    return app


def _ensure_schema():
    """Add any columns introduced after the initial schema (idempotent)."""
    from sqlalchemy import inspect, text
    inspector = inspect(db.engine)
    user_cols = [c["name"] for c in inspector.get_columns("users")]
    with db.engine.connect() as conn:
        if "accent_color" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN accent_color VARCHAR(20)"))
        if "plain_password" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN plain_password VARCHAR(256)"))
        conn.commit()


def _backfill_plain_passwords():
    """One-time backfill: populate plain_password for seeded users that predate the column."""
    _KNOWN = {
        "admin":    "S4U21",
        "amelia":   "NbrnTP3f",
        "ammar":    "AbnFbmOH",
        "atul":     "nKYaXRvj",
        "aryan":    "7uff0LYT",
        "aylin":    "H8xIZM1J",
        "jagdeep":  "Rcoreogr",
        "dilara":   "Nwwmq6OL",
        "jason":    "kTkx9NIQ",
        "jeet":     "0Wobtqn6",
        "jenny":    "2tOy4Cqp",
        "mayank":   "IqK3yn9F",
        "selcuk":   "fcgMXAdx",
        "nikki":    "9G81aSQH",
        "zelal":    "qNgAC72q",
        "amir":     "Fl41sNLj",
        "atakan":   "VHWGaub5",
        "kader":    "2Ztd26fE",
        "mehmet":   "eVVhDIq2",
        "nasta":    "AnHTmt9O",
        "zilan":    "BGhnuKon",
        "martin":   "eNo41eoP",
        "ceyda":    "ni6JDWYl",
        "amelka":   "gAACTP9g",
        "helin":    "yv1plBAr",
    }
    changed = False
    for user in User.query.filter(User.plain_password.is_(None)).all():
        if user.username in _KNOWN:
            user.plain_password = _KNOWN[user.username]
            changed = True
    if changed:
        db.session.commit()


def _ensure_branches():
    """Add any missing default branches on startup (idempotent)."""
    from models import Branch
    defaults = [
        {"name": "Schiller",    "location": "Schillerstraße"},
        {"name": "Turm",        "location": "Turmstraße"},
        {"name": "Haupt",       "location": "Hauptstraße"},
        {"name": "Kurfürst",    "location": "Kurfürstenstraße"},
        {"name": "Frankfurter", "location": "Frankfurter Allee"},
    ]
    changed = False
    for b in defaults:
        if not Branch.query.filter_by(name=b["name"]).first():
            db.session.add(Branch(**b))
            changed = True
    if changed:
        db.session.commit()


app = create_app()


@app.cli.command("reset-availability")
def reset_availability():
    """Delete all availability records for the current week (testing helper)."""
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    from models import Availability

    today      = datetime.now(ZoneInfo("Europe/Berlin")).date()
    week_start = today - timedelta(days=today.weekday())

    deleted = Availability.query.filter_by(week_start=week_start).delete()
    db.session.commit()
    print(f"Deleted {deleted} availability record(s) for week of {week_start}.")


if __name__ == "__main__":
    app.run(debug=True)
