"""add_products_tables

Revision ID: 9e1b7d4f2c8a
Revises: 7a3f9c2e5b1d
Create Date: 2026-07-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '9e1b7d4f2c8a'
down_revision: Union[str, None] = '7a3f9c2e5b1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('products',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('business_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('type', sa.Text(), nullable=False),
    sa.Column('is_hero', sa.Boolean(), nullable=False, server_default='false'),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('key_features', postgresql.ARRAY(sa.Text()), nullable=False, server_default='{}'),
    sa.Column('benefits', postgresql.ARRAY(sa.Text()), nullable=False, server_default='{}'),
    sa.Column('pricing_model', sa.Text(), nullable=False),
    sa.Column('pricing_tier', sa.Text(), nullable=False),
    sa.Column('pricing_details', sa.Text(), nullable=True),
    sa.Column('unique_selling_points', postgresql.ARRAY(sa.Text()), nullable=False, server_default='{}'),
    sa.Column('target_use_case', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("type IN ('saas_product', 'physical', 'service', 'subscription', 'digital', 'marketplace')", name='chk_products_type'),
    sa.CheckConstraint("pricing_model IN ('one_time', 'subscription', 'freemium', 'pay_per_use', 'enterprise', 'free')", name='chk_products_pricing_model'),
    sa.CheckConstraint("pricing_tier IN ('free', 'low', 'mid', 'premium', 'enterprise')", name='chk_products_pricing_tier'),
    sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_products_business_id', 'products', ['business_id'])

    op.create_table('product_images',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('product_id', sa.UUID(), nullable=False),
    sa.Column('storage_url', sa.Text(), nullable=False),
    sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_product_images_product_id', 'product_images', ['product_id'])
    # Guarantees "at most one primary image per product" at the DB level,
    # not just by convention in the SPs.
    op.create_index(
        'uq_product_images_primary_per_product',
        'product_images',
        ['product_id'],
        unique=True,
        postgresql_where=sa.text('is_primary'),
    )


def downgrade() -> None:
    op.drop_index('uq_product_images_primary_per_product', table_name='product_images')
    op.drop_index('ix_product_images_product_id', table_name='product_images')
    op.drop_table('product_images')
    op.drop_index('ix_products_business_id', table_name='products')
    op.drop_table('products')
