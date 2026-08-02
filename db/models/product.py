from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Text, Boolean, DateTime, ForeignKey, func, text, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.models.base import Base

if TYPE_CHECKING:
    from db.models.business import Business
    from db.models.product_image import ProductImage


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint(
            "type IN ('saas_product', 'physical', 'service', 'subscription', 'digital', 'marketplace')",
            name="chk_products_type",
        ),
        CheckConstraint(
            "pricing_model IN ('one_time', 'subscription', 'freemium', 'pay_per_use', 'enterprise', 'free')",
            name="chk_products_pricing_model",
        ),
        CheckConstraint(
            "pricing_tier IN ('free', 'low', 'mid', 'premium', 'enterprise')",
            name="chk_products_pricing_tier",
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
    name: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    is_hero: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    key_features: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    benefits: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    pricing_model: Mapped[str] = mapped_column(Text, nullable=False)
    pricing_tier: Mapped[str] = mapped_column(Text, nullable=False)
    pricing_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    unique_selling_points: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    target_use_case: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    business: Mapped[Business] = relationship("Business", back_populates="products")
    images: Mapped[list[ProductImage]] = relationship(
        "ProductImage", back_populates="product", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Product id={self.id} name={self.name}>"
