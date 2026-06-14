from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session


def create(
    db: Session,
    *,
    user_id: uuid.UUID,
    token_hash: str,
    expires_at: datetime,
) -> dict:
    row = db.execute(
        text(
            "SELECT * FROM sp_create_refresh_token(:user_id, :token_hash, :expires_at)"
        ),
        {"user_id": str(user_id), "token_hash": token_hash, "expires_at": expires_at},
    ).mappings().first()
    db.commit()
    return dict(row)


def get_by_hash(db: Session, token_hash: str) -> Optional[dict]:
    row = db.execute(
        text("SELECT * FROM sp_get_refresh_token_by_hash(:token_hash)"),
        {"token_hash": token_hash},
    ).mappings().first()
    return dict(row) if row else None


def revoke_by_hash(db: Session, token_hash: str) -> None:
    db.execute(
        text("SELECT sp_revoke_refresh_token(:token_hash)"),
        {"token_hash": token_hash},
    )
    db.commit()


def revoke_all_for_user(db: Session, user_id: uuid.UUID) -> None:
    db.execute(
        text("SELECT sp_revoke_all_user_tokens(:user_id)"),
        {"user_id": str(user_id)},
    )
    db.commit()
