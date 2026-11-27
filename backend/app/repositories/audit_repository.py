from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import AuditLog
from app.schemas.audit import AuditFilters


class AuditRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self, filters: AuditFilters, *, offset: int, limit: int) -> tuple[list[AuditLog], int]:
        query = select(AuditLog)
        if filters.date_from is not None:
            query = query.where(AuditLog.created_at >= filters.date_from)
        if filters.date_to is not None:
            query = query.where(AuditLog.created_at <= filters.date_to)
        if filters.actor_id is not None:
            query = query.where(AuditLog.actor_id == filters.actor_id)
        if filters.event_types:
            query = query.where(AuditLog.event_type.in_(filters.event_types))
        total = self.db.scalar(select(func.count()).select_from(query.subquery()))
        logs = self.db.scalars(
            query.options(joinedload(AuditLog.actor))
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset(offset)
            .limit(limit)
        ).all()
        return list(logs), total
