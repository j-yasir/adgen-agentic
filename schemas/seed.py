from __future__ import annotations

from pydantic import BaseModel


class SeedDemoDataResponse(BaseModel):
    businesses: int
    products: int
    product_images: int
    campaigns: int
    assets: int
    events: int
