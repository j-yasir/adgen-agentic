from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class CreateProductFromUrlRequest(BaseModel):
    """Kick off URL-based product onboarding — a research agent (web_search
    only) fills in the product profile, and a separate deterministic step
    (utils/product_image_finder.py — no LLM) tries to find and attach a real
    product photo. Synchronous: unlike business onboarding, one product is
    small enough to complete within a normal request/response cycle."""
    url: str = Field(..., description="A product page URL, or a business/category page — the agent identifies the featured product")

    @field_validator("url")
    @classmethod
    def _validate_url(cls, v: str) -> str:
        v = v.strip()
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("url must start with http:// or https://")
        return v


class CreateProductRequest(BaseModel):
    name: str
    type: Literal[
        "saas_product", "physical", "service", "subscription", "digital", "marketplace"
    ]
    is_hero: bool = False
    description: str
    key_features: list[str] = Field(..., min_length=1, max_length=8)
    benefits: list[str] = Field(..., min_length=1, max_length=8)
    pricing_model: Literal[
        "one_time", "subscription", "freemium", "pay_per_use", "enterprise", "free"
    ]
    pricing_tier: Literal["free", "low", "mid", "premium", "enterprise"]
    pricing_details: Optional[str] = None
    unique_selling_points: list[str] = Field(..., min_length=1, max_length=5)
    target_use_case: Optional[str] = None


class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    type: Optional[Literal[
        "saas_product", "physical", "service", "subscription", "digital", "marketplace"
    ]] = None
    is_hero: Optional[bool] = None
    description: Optional[str] = None
    key_features: Optional[list[str]] = None
    benefits: Optional[list[str]] = None
    pricing_model: Optional[Literal[
        "one_time", "subscription", "freemium", "pay_per_use", "enterprise", "free"
    ]] = None
    pricing_tier: Optional[Literal["free", "low", "mid", "premium", "enterprise"]] = None
    pricing_details: Optional[str] = None
    unique_selling_points: Optional[list[str]] = None
    target_use_case: Optional[str] = None


class ProductImageResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    storage_url: str
    is_primary: bool
    created_at: datetime


class ProductResponse(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    name: str
    type: str
    is_hero: bool
    description: str
    key_features: list[str]
    benefits: list[str]
    pricing_model: str
    pricing_tier: str
    pricing_details: Optional[str]
    unique_selling_points: list[str]
    target_use_case: Optional[str]
    created_at: datetime
    updated_at: datetime
    images: list[ProductImageResponse] = Field(default_factory=list)


class ProductListResponse(BaseModel):
    products: list[ProductResponse]
    total: int
