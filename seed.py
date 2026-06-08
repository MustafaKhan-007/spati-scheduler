"""
Idempotent seed script — run once after first deploy.
  Render shell:  python seed.py
  Locally:       python seed.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from models import db, User, Branch
from werkzeug.security import generate_password_hash

USERS = [
    {"username": "ali",   "password": "spati123", "full_name": "Ali Yilmaz",  "role": "employee"},
    {"username": "sara",  "password": "spati123", "full_name": "Sara Müller", "role": "employee"},
    {"username": "admin", "password": "admin999", "full_name": "Owner",        "role": "admin"},
]

BRANCHES = [
    {"name": "Spati Mitte", "location": "Berlin Mitte"},
    {"name": "Frankfurt",   "location": "Frankfurt am Main"},
]


def seed():
    with app.app_context():
        db.create_all()

        for u in USERS:
            if not User.query.filter_by(username=u["username"]).first():
                user = User(
                    username=u["username"],
                    password_hash=generate_password_hash(u["password"]),
                    full_name=u["full_name"],
                    role=u["role"],
                )
                db.session.add(user)
                print(f"  ✓ Created user: {u['username']} ({u['role']})")
            else:
                print(f"  – User already exists: {u['username']}")

        for b in BRANCHES:
            if not Branch.query.filter_by(name=b["name"]).first():
                branch = Branch(**b)
                db.session.add(branch)
                print(f"  ✓ Created branch: {b['name']}")
            else:
                print(f"  – Branch already exists: {b['name']}")

        db.session.commit()
        print("\nSeeding complete!")


if __name__ == "__main__":
    seed()
