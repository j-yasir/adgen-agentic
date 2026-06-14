from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session


def create(db: Session, *, name: str, email: str, password_hash: str) -> dict:
    row = db.execute(
        text("SELECT * FROM sp_create_user(:name, :email, :password_hash)"),
        {"name": name, "email": email, "password_hash": password_hash},
    ).mappings().first()
    db.commit()
    return dict(row)


def get_by_email(db: Session, email: str) -> Optional[dict]:
    row = db.execute(
        text("SELECT * FROM sp_get_user_by_email(:email)"),
        {"email": email},
    ).mappings().first()
    return dict(row) if row else None


def get_by_id(db: Session, user_id: uuid.UUID | str) -> Optional[dict]:
    row = db.execute(
        text("SELECT * FROM sp_get_user_by_id(:user_id)"),
        {"user_id": str(user_id)},
    ).mappings().first()
    return dict(row) if row else None
