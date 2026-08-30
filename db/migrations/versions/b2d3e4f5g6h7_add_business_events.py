"""add_business_events

Revision ID: b2d3e4f5g6h7
Revises: a1c2d3e4f5g6
Create Date: 2026-08-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b2d3e4f5g6h7'
down_revision: Union[str, None] = 'a1c2d3e4f5g6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'business_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('seq', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('event_type', sa.Text(), nullable=False),
        sa.Column('agent', sa.Text(), nullable=True),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "event_type IN ('agent_started', 'agent_completed', 'agent_error', 'tool_call', 'tool_result', "
            "'status_changed', 'business_ready', 'business_failed')",
            name='chk_business_events_event_type',
        ),
        sa.CheckConstraint(
            "agent IN ('researcher', 'system', 'orchestrator')",
            name='chk_business_events_agent',
        ),
    )


def downgrade() -> None:
    op.drop_table('business_events')
