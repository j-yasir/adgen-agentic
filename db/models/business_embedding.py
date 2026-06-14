from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Text, DateTime, ForeignKey, func, text, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from db.models.base import Base

if TYPE_CHECKING:
    from db.models.business import Business
    from db.models.campaign import Campaign


class BusinessEmbedding(Base):
    __tablename__ = "business_embeddings"
    __table_args__ = (
        CheckConstraint(
            "content_type IN ('bko', 'campaign_summary')",
            name="chk_embeddings_content_type",
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
    # nullable — null for base BKO embedding, set for campaign summary embeddings
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="SET NULL"),
        nullable=True,
    )
    content_type: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(768), nullable=False)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    business: Mapped[Business] = relationship("Business", back_populates="embeddings")
    campaign: Mapped[Campaign | None] = relationship("Campaign", back_populates="embeddings")

    def __repr__(self) -> str:
        return f"<BusinessEmbedding id={self.id} type={self.content_type}>"
