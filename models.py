from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'employee' or 'admin'
    full_name = db.Column(db.String(120), nullable=False)

    availabilities = db.relationship("Availability", backref="user", lazy=True, cascade="all, delete-orphan")
    shifts = db.relationship("Shift", backref="user", lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<User {self.username}>"


class Branch(db.Model):
    __tablename__ = "branches"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200))

    shifts = db.relationship("Shift", backref="branch", lazy=True)

    def __repr__(self):
        return f"<Branch {self.name}>"


class Availability(db.Model):
    __tablename__ = "availability"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    week_start = db.Column(db.Date, nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False)  # 0=Mon … 6=Sun
    slot = db.Column(db.String(20), nullable=False)       # 'morning' | 'evening' | 'night'
    is_available = db.Column(db.Boolean, default=False, nullable=False)

    def __repr__(self):
        return f"<Availability user={self.user_id} day={self.day_of_week} slot={self.slot}>"


class Shift(db.Model):
    __tablename__ = "shifts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=False)
    week_start = db.Column(db.Date, nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False)  # 0=Mon … 6=Sun
    slot = db.Column(db.String(20), nullable=False)       # 'morning' | 'evening' | 'night'

    def __repr__(self):
        return f"<Shift user={self.user_id} day={self.day_of_week} slot={self.slot}>"
