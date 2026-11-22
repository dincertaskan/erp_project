from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.routing import SessionReleasingRoute

router = APIRouter(tags=["Health"], route_class=SessionReleasingRoute)


@router.get("/health")
def health(db: Session = Depends(get_db)):
    """Uygulamanın ve veritabanı bağlantısının durumunu döndürür."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "error", "database": "unavailable"})
    return {"status": "ok", "database": "ok"}
