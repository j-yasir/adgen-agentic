"""add_campaign_brief_fields

Revision ID: 4cb5eeb9d42f
Revises: 0fcc9913fd20
Create Date: 2026-06-21 11:27:28.838693

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4cb5eeb9d42f'
down_revision: Union[str, None] = '0fcc9913fd20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('campaigns', sa.Column('campaign_name', sa.Text(), nullable=True))
    op.add_column('campaigns', sa.Column('objective', sa.Text(), nullable=False, server_default='awareness'))
    op.add_column('campaigns', sa.Column('funnel_stage', sa.Text(), nullable=False, server_default='balanced'))
    op.add_column('campaigns', sa.Column('num_variants', sa.Integer(), nullable=False, server_default='3'))
    op.add_column('campaigns', sa.Column('special_brief', sa.Text(), nullable=True))

    op.create_check_constraint(
        'chk_campaigns_objective',
        'campaigns',
        "objective IN ('awareness', 'traffic', 'conversion', 'lead_gen', 'engagement')",
    )
    op.create_check_constraint(
        'chk_campaigns_funnel_stage',
        'campaigns',
        "funnel_stage IN ('tofu', 'mofu', 'bofu', 'balanced')",
    )

    # Extend asset_type CHECK to include 'email'
    op.drop_constraint('chk_assets_type', 'assets')
    op.create_check_constraint(
        'chk_assets_type',
        'assets',
        "asset_type IN ('image', 'video', 'voice', 'email')",
    )


def downgrade() -> None:
    op.drop_column('campaigns', 'special_brief')
    op.drop_column('campaigns', 'num_variants')
    op.drop_column('campaigns', 'funnel_stage')
    op.drop_column('campaigns', 'objective')
    op.drop_column('campaigns', 'campaign_name')

    op.drop_constraint('chk_campaigns_objective', 'campaigns', type_='check')
    op.drop_constraint('chk_campaigns_funnel_stage', 'campaigns', type_='check')

    op.drop_constraint('chk_assets_type', 'assets', type_='check')
    op.create_check_constraint(
        'chk_assets_type',
        'assets',
        "asset_type IN ('image', 'video', 'voice')",
    )
