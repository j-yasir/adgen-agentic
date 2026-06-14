from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import text

_SQL_DIR = Path(__file__).parent


def load_stored_procedures(db: Session) -> None:
    for sql_file in sorted(_SQL_DIR.rglob("*.sql")):
        db.execute(text(sql_file.read_text()))
    db.commit()
