from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Text, BigInteger, DateTime, ForeignKey, func, text, CheckConstraint, Identity
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.models.base import Base

if TYPE_CHECKING:
    from db.models.campaign import Campaign


class CampaignEvent(Base):
    __tablename__ = "campaign_events"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('agent_start', 'tool_call', 'tool_result', 'agent_done', "
            "'human_review_required', 'campaign_done', 'campaign_failed')",
            name="chk_events_event_type",
        ),
        CheckConstraint(
            "agent IN ('researcher', 'strategist', 'producer', 'auditor', 'system')",
            name="chk_events_agent",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
    )
    # GENERATED ALWAYS AS IDENTITY — monotonically increasing per row, guarantees ordering
    seq: Mapped[int] = mapped_column(
        BigInteger,
        Identity(always=True),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    campaign: Mapped[Campaign] = relationship("Campaign", back_populates="events")

    def __repr__(self) -> str:
        return f"<CampaignEvent id={self.id} type={self.event_type} seq={self.seq}>"
