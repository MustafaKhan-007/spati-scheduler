"""
Seed / reseed script.

  First deploy  →  python seed.py
  Full reset    →  python seed.py --reset

--reset wipes all shifts, availability, employees and branches
before inserting the canonical data below.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from models import db, User, Branch, Availability, Shift
from werkzeug.security import generate_password_hash

# ── Branches ────────────────────────────────────────────────────────────────
BRANCHES = [
    {"name": "Schiller",    "location": "Schillerstraße"},
    {"name": "Turm",        "location": "Turmstraße"},
    {"name": "Haupt",       "location": "Hauptstraße"},
    {"name": "Kurfürst",    "location": "Kurfürstenstraße"},
    {"name": "Frankfurter", "location": "Frankfurter Allee"},
]

# ── Employees ────────────────────────────────────────────────────────────────
# username = first name (lowercase), password = random 8-char alphanumeric
EMPLOYEES = [
    {"username": "amelia",   "password": "NbrnTP3f", "full_name": "Amelia"},
    {"username": "ammar",    "password": "AbnFbmOH", "full_name": "Ammar"},
    {"username": "atul",     "password": "nKYaXRvj", "full_name": "Atul"},
    {"username": "aryan",    "password": "7uff0LYT", "full_name": "Aryan"},
    {"username": "aylin",    "password": "H8xIZM1J", "full_name": "Aylin"},
    {"username": "jagdeep",  "password": "Rcoreogr", "full_name": "Jagdeep"},
    {"username": "dilara",   "password": "Nwwmq6OL", "full_name": "Dilara"},
    {"username": "jason",    "password": "kTkx9NIQ", "full_name": "Jason"},
    {"username": "jeet",     "password": "0Wobtqn6", "full_name": "Jeet"},
    {"username": "jenny",    "password": "2tOy4Cqp", "full_name": "Jenny"},
    {"username": "mayank",   "password": "IqK3yn9F", "full_name": "Mayank"},
    {"username": "selcuk",   "password": "fcgMXAdx", "full_name": "Selçuk"},
    {"username": "nikki",    "password": "9G81aSQH", "full_name": "Nikki"},
    {"username": "zelal",    "password": "qNgAC72q", "full_name": "Zelal"},
    {"username": "amir",     "password": "Fl41sNLj", "full_name": "Amir"},
    {"username": "atakan",   "password": "VHWGaub5", "full_name": "Atakan"},
    {"username": "kader",    "password": "2Ztd26fE", "full_name": "Kader"},
    {"username": "mehmet",   "password": "eVVhDIq2", "full_name": "Mehmet"},
    {"username": "nasta",    "password": "AnHTmt9O", "full_name": "Nasta"},
    {"username": "zilan",    "password": "BGhnuKon", "full_name": "Zilan"},
    {"username": "martin",   "password": "eNo41eoP", "full_name": "Martin"},
    {"username": "ceyda",    "password": "ni6JDWYl", "full_name": "Ceyda"},
    {"username": "amelka",   "password": "gAACTP9g", "full_name": "Amelka"},
    {"username": "helin",    "password": "yv1plBAr", "full_name": "Helin"},
]

# ── Admin account (kept across resets) ──────────────────────────────────────
ADMIN = {"username": "admin", "password": "S4U21", "full_name": "Admin", "role": "admin"}


def _reset(ctx):
    """Wipe all schedule data, employees, branches, AND the admin account."""
    print("⚠  Resetting database …")
    Shift.query.delete()
    Availability.query.delete()
    User.query.delete()   # removes everyone, including admin
    Branch.query.delete()
    db.session.commit()
    print("   All users, branches and schedule data removed.\n")


def seed(reset=False):
    with app.app_context():
        db.create_all()

        if reset:
            _reset(app.app_context())

        # Admin — always create or update password
        existing_admin = User.query.filter_by(username=ADMIN["username"]).first()
        if existing_admin:
            existing_admin.password_hash  = generate_password_hash(ADMIN["password"])
            existing_admin.plain_password = ADMIN["password"]
            print(f"  ✓ Admin password updated")
        else:
            db.session.add(User(
                username=ADMIN["username"],
                password_hash=generate_password_hash(ADMIN["password"]),
                plain_password=ADMIN["password"],
                full_name=ADMIN["full_name"],
                role=ADMIN["role"],
            ))
            print(f"  ✓ Admin created")

        # Employees
        print()
        print(f"  {'Username':<12} {'Password':<12} {'Full name'}")
        print(f"  {'-'*12} {'-'*12} {'-'*16}")
        for e in EMPLOYEES:
            existing = User.query.filter_by(username=e["username"]).first()
            if not existing:
                db.session.add(User(
                    username=e["username"],
                    password_hash=generate_password_hash(e["password"]),
                    plain_password=e["password"],
                    full_name=e["full_name"],
                    role="employee",
                ))
                print(f"  ✓ {e['username']:<12} {e['password']:<12} {e['full_name']}")
            else:
                if existing.plain_password is None:
                    existing.plain_password = e["password"]
                    print(f"  ✓ {e['username']:<12} (plain_password backfilled)")
                else:
                    print(f"  – {e['username']:<12} (already exists)")

        # Branches
        print()
        for b in BRANCHES:
            if not Branch.query.filter_by(name=b["name"]).first():
                db.session.add(Branch(**b))
                print(f"  ✓ Branch: {b['name']}")
            else:
                print(f"  – Branch already exists: {b['name']}")

        db.session.commit()
        print("\nSeeding complete!")


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
