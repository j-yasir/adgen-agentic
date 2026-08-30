from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Text, BigInteger, DateTime, ForeignKey, func, text, CheckConstraint, Identity
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.models.base import Base

if TYPE_CHECKING:
    from db.models.business import Business


class BusinessEvent(Base):
    __tablename__ = "business_events"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('agent_started', 'agent_completed', 'agent_error', 'tool_call', 'tool_result', "
            "'status_changed', 'business_ready', 'business_failed')",
            name="chk_business_events_event_type",
        ),
        CheckConstraint(
            "agent IN ('researcher', 'system', 'orchestrator')",
            name="chk_business_events_agent",
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

    business: Mapped[Business] = relationship("Business")

    def __repr__(self) -> str:
        return f"<BusinessEvent id={self.id} type={self.event_type} seq={self.seq}>"
