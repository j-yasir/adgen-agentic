from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Text, Boolean, DateTime, ForeignKey, func, text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.models.base import Base

if TYPE_CHECKING:
    from db.models.product import Product


class ProductImage(Base):
    __tablename__ = "product_images"
    __table_args__ = (
        # At most one primary image per product, enforced at the DB level —
        # matches the migration's partial unique index exactly.
        Index(
            "uq_product_images_primary_per_product",
            "product_id",
            unique=True,
            postgresql_where=text("is_primary"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    storage_url: Mapped[str] = mapped_column(Text, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    product: Mapped[Product] = relationship("Product", back_populates="images")

    def __repr__(self) -> str:
        return f"<ProductImage id={self.id} product_id={self.product_id} is_primary={self.is_primary}>"
