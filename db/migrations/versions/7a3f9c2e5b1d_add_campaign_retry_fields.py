"""add_campaign_retry_fields

Revision ID: 7a3f9c2e5b1d
Revises: 4cb5eeb9d42f
Create Date: 2026-07-10 20:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a3f9c2e5b1d'
down_revision: Union[str, None] = '4cb5eeb9d42f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Durable-execution retry support: a node failure sets status='failed' as
    # before, but resumable + failed_node let the API distinguish "retryable
    # step failure" from a permanent error (e.g. business not found), so the
    # graph can be re-entered from its LangGraph checkpoint instead of forcing
    # a full campaign relaunch.
    op.add_column('campaigns', sa.Column('resumable', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('campaigns', sa.Column('failed_node', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('campaigns', 'failed_node')
    op.drop_column('campaigns', 'resumable')
