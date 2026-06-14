import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from jose import jwt

from config import settings

_ALGORITHM = "HS256"


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "access"},
        settings.JWT_SECRET_KEY,
        algorithm=_ALGORITHM,
    )


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[_ALGORITHM])


def create_refresh_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hash).  Only the hash is stored in the DB."""
    raw = secrets.token_urlsafe(64)
    return raw, _hash(raw)


def hash_refresh_token(raw: str) -> str:
    return _hash(raw)


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()
