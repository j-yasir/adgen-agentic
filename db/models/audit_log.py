from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Text, Integer, Float, DateTime, ForeignKey, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.models.base import Base

if TYPE_CHECKING:
    from db.models.asset import Asset
    from db.models.campaign import Campaign


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False,
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
    )
    iteration: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    brand_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    hook_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    platform_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    weighted_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    critique: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    asset: Mapped[Asset] = relationship("Asset", back_populates="audit_logs")
    campaign: Mapped[Campaign] = relationship("Campaign", back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} asset_id={self.asset_id} iter={self.iteration} score={self.weighted_avg}>"
