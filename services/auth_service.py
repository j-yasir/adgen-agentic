from __future__ import annotations

from datetime import datetime, timedelta, timezone

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
from utils.exceptions import ConflictError, UnauthorizedError
from utils.jwt import create_access_token, create_refresh_token, hash_refresh_token
from utils.logger import get_logger
from utils.password import hash_password, verify_password

logger = get_logger(__name__)


def signup(db: Session, data: SignupRequest) -> SignupResponse:
    logger.info("Signup attempt for email=%s", data.email)

    if user_repo.get_by_email(db, data.email):
        logger.warning("Signup rejected — email already registered: %s", data.email)
        raise ConflictError("Email already registered")

    user = user_repo.create(
        db,
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    logger.info("User created successfully: id=%s email=%s", user["id"], user["email"])

    access_token = create_access_token(str(user["id"]))
    raw_refresh, hashed_refresh = create_refresh_token()
    _store_refresh_token(db, user["id"], hashed_refresh)

    return SignupResponse(
        user=UserResponse(**user),
        access_token=access_token,
        refresh_token=raw_refresh,
    )


def login(db: Session, data: LoginRequest) -> TokenResponse:
    logger.info("Login attempt for email=%s", data.email)

    user = user_repo.get_by_email(db, data.email)
    if not user or not verify_password(data.password, user["password_hash"]):
        logger.warning("Login failed — invalid credentials for email=%s", data.email)
        raise UnauthorizedError("Invalid credentials")

    logger.info("Login successful: id=%s email=%s", user["id"], user["email"])

    access_token = create_access_token(str(user["id"]))
    raw_refresh, hashed_refresh = create_refresh_token()
    _store_refresh_token(db, user["id"], hashed_refresh)

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


def refresh_tokens(db: Session, raw_refresh: str) -> TokenResponse:
    logger.debug("Token refresh requested")

    token_hash = hash_refresh_token(raw_refresh)
    token = refresh_token_repo.get_by_hash(db, token_hash)

    if not token:
        logger.warning("Token refresh failed — token not found")
        raise UnauthorizedError("Invalid or expired refresh token")

    if token["revoked"]:
        logger.warning("Token refresh failed — token already revoked, user_id=%s", token["user_id"])
        raise UnauthorizedError("Refresh token has been revoked")

    if token["expires_at"] < datetime.now(timezone.utc):
        logger.warning("Token refresh failed — token expired, user_id=%s", token["user_id"])
        raise UnauthorizedError("Refresh token has expired")

    refresh_token_repo.revoke_by_hash(db, token_hash)

    access_token = create_access_token(str(token["user_id"]))
    raw_new, hashed_new = create_refresh_token()
    _store_refresh_token(db, token["user_id"], hashed_new)

    logger.info("Token refreshed successfully for user_id=%s", token["user_id"])
    return TokenResponse(access_token=access_token, refresh_token=raw_new)


def logout(db: Session, raw_refresh: str) -> None:
    logger.debug("Logout requested")
    token_hash = hash_refresh_token(raw_refresh)
    refresh_token_repo.revoke_by_hash(db, token_hash)
    logger.info("Logout successful — token revoked")


def logout_all(db: Session, user_id: str) -> None:
    logger.info("Logout-all requested for user_id=%s", user_id)
    refresh_token_repo.revoke_all_for_user(db, user_id)
    logger.info("All tokens revoked for user_id=%s", user_id)


def _store_refresh_token(db: Session, user_id: object, token_hash: str) -> None:
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
    )
    refresh_token_repo.create(
        db, user_id=user_id, token_hash=token_hash, expires_at=expires_at
    )
