from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.dependencies import get_current_user
from db.session import get_db
from schemas.seed import SeedDemoDataResponse
from services import seed_service

router = APIRouter(prefix="/seed", tags=["seed"])


@router.post(
    "/demo-data",
    response_model=SeedDemoDataResponse,
    summary="Seed the authenticated account with pre-generated demo data",
    description=(
        "Copies a full pre-built demo account — businesses, products, product "
        "images, campaigns, and generated assets — into the caller's own "
        "account, with every ID freshly generated. Self-service: any "
        "authenticated user can call this on their own account. Refuses if "
        "the account already has businesses unless force=true (additive, "
        "not a replace)."
    ),
)
def seed_demo_data(
    force: bool = Query(False, description="Seed even if this account already has data"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return seed_service.seed_demo_data(db, user_id=current_user["id"], force=force)
