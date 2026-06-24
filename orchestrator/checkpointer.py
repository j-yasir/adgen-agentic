from __future__ import annotations

from config import settings


def get_checkpointer_dsn() -> str:
    """
    Convert the SQLAlchemy DATABASE_URL to a plain psycopg-v3 connection string.
    AsyncPostgresSaver uses psycopg (v3), which accepts postgresql:// directly.
    SQLAlchemy uses the postgresql+psycopg2:// dialect prefix — we strip it here.
    """
    return settings.DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://", 1)
