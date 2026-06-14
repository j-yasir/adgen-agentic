from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Text, Integer, DateTime, ForeignKey, func, text, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.models.base import Base

if TYPE_CHECKING:
    from db.models.user import User
    from db.models.campaign import Campaign
    from db.models.business_embedding import BusinessEmbedding


class Business(Base):
    __tablename__ = "businesses"
    __table_args__ = (
        CheckConstraint(
            "onboarding_path IN ('url', 'free_text', 'form')",
            name="chk_businesses_onboarding_path",
        ),
        CheckConstraint(
            "onboarding_status IN ('pending', 'complete')",
            name="chk_businesses_onboarding_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    website: Mapped[str | None] = mapped_column(Text, nullable=True)
    industry: Mapped[str | None] = mapped_column(Text, nullable=True)
    bko: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    bko_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    onboarding_path: Mapped[str] = mapped_column(Text, nullable=False)
    onboarding_status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # relationships
    user: Mapped[User] = relationship("User", back_populates="businesses")
    campaigns: Mapped[list[Campaign]] = relationship(
        "Campaign", back_populates="business", cascade="all, delete-orphan"
    )
    embeddings: Mapped[list[BusinessEmbedding]] = relationship(
        "BusinessEmbedding", back_populates="business", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Business id={self.id} name={self.name}>"
