from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from config import settings
from repos import refresh_token_repo, user_repo
from schemas.auth import (
    LoginRequest,
    SignupRequest,
    SignupResponse,
    TokenResponse,
    UserResponse,
)
from utils.jwt import create_access_token, create_refresh_token, hash_refresh_token
from utils.password import hash_password, verify_password


def signup(db: Session, data: SignupRequest) -> SignupResponse:
    if user_repo.get_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = user_repo.create(
        db,
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
    )

    access_token = create_access_token(str(user["id"]))
    raw_refresh, hashed_refresh = create_refresh_token()
    _store_refresh_token(db, user["id"], hashed_refresh)

    return SignupResponse(
        user=UserResponse(**user),
        access_token=access_token,
        refresh_token=raw_refresh,
    )


def login(db: Session, data: LoginRequest) -> TokenResponse:
    user = user_repo.get_by_email(db, data.email)
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    access_token = create_access_token(str(user["id"]))
    raw_refresh, hashed_refresh = create_refresh_token()
    _store_refresh_token(db, user["id"], hashed_refresh)

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


def refresh_tokens(db: Session, raw_refresh: str) -> TokenResponse:
    token_hash = hash_refresh_token(raw_refresh)
    token = refresh_token_repo.get_by_hash(db, token_hash)

    if (
        not token
        or token["revoked"]
        or token["expires_at"] < datetime.now(timezone.utc)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    refresh_token_repo.revoke_by_hash(db, token_hash)

    access_token = create_access_token(str(token["user_id"]))
    raw_new, hashed_new = create_refresh_token()
    _store_refresh_token(db, token["user_id"], hashed_new)

    return TokenResponse(access_token=access_token, refresh_token=raw_new)


def logout(db: Session, raw_refresh: str) -> None:
    token_hash = hash_refresh_token(raw_refresh)
    refresh_token_repo.revoke_by_hash(db, token_hash)


def logout_all(db: Session, user_id: str) -> None:
    refresh_token_repo.revoke_all_for_user(db, user_id)


def _store_refresh_token(db: Session, user_id, token_hash: str) -> None:
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
    )
    refresh_token_repo.create(
        db, user_id=user_id, token_hash=token_hash, expires_at=expires_at
    )
