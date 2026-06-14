from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.session import get_db
from sql import load_stored_procedures

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/load-procedures", summary="(Re)load all SQL stored procedures")
def load_procedures(db: Session = Depends(get_db)):
    load_stored_procedures(db)
    return {"status": "ok", "detail": "All stored procedures loaded successfully"}
