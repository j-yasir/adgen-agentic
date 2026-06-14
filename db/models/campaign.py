from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Text, Integer, Float, DateTime, ForeignKey, func, text, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.models.base import Base

if TYPE_CHECKING:
    from db.models.user import User
    from db.models.business import Business
    from db.models.campaign_event import CampaignEvent
    from db.models.asset import Asset
    from db.models.audit_log import AuditLog
    from db.models.human_review import HumanReview
    from db.models.business_embedding import BusinessEmbedding


class Campaign(Base):
    __tablename__ = "campaigns"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'running', 'awaiting_review', 'done', 'failed')",
            name="chk_campaigns_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    goal: Mapped[str] = mapped_column(Text, nullable=False)
    platforms: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    asset_formats: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    strategy_doc: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    audit_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # relationships
    user: Mapped[User] = relationship("User", back_populates="campaigns")
    business: Mapped[Business] = relationship("Business", back_populates="campaigns")
    events: Mapped[list[CampaignEvent]] = relationship(
        "CampaignEvent", back_populates="campaign", cascade="all, delete-orphan"
    )
    assets: Mapped[list[Asset]] = relationship(
        "Asset", back_populates="campaign", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list[AuditLog]] = relationship(
        "AuditLog", back_populates="campaign", cascade="all, delete-orphan"
    )
    human_reviews: Mapped[list[HumanReview]] = relationship(
        "HumanReview", back_populates="campaign", cascade="all, delete-orphan"
    )
    embeddings: Mapped[list[BusinessEmbedding]] = relationship(
        "BusinessEmbedding", back_populates="campaign"
    )

    def __repr__(self) -> str:
        return f"<Campaign id={self.id} status={self.status}>"
