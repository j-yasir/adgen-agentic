from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from db.session import get_db
from repos import user_repo
from utils.jwt import decode_access_token

_bearer = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> dict:
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise JWTError()
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = user_repo.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


def get_current_user_from_query(
    token: Optional[str] = Query(None),
    request: Request = None,
    db: Session = Depends(get_db),
) -> dict:
    """Accepts JWT from ?token= query param (for EventSource/SSE) or Authorization header."""
    raw_token = token

    if not raw_token:
        auth_header = request.headers.get("authorization", "") if request else ""
        if auth_header.startswith("Bearer "):
            raw_token = auth_header[7:]

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )

    try:
        payload = decode_access_token(raw_token)
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise JWTError()
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = user_repo.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user
