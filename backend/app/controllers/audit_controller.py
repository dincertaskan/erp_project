from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.routing import SessionReleasingRoute
from app.models import AuditEvent, User, UserRole
from app.repositories.audit_repository import AuditRepository
from app.schemas.audit import AuditFilters, AuditLogOut
from app.schemas.common import BusinessDateTime, Page, PageParams

router = APIRouter(prefix="/audit-logs", tags=["İşlem Geçmişi"], route_class=SessionReleasingRoute)

admin_only = require_roles(UserRole.ADMIN)


@router.get("", response_model=Page[AuditLogOut])
def list_audit_logs(
    page: PageParams = Depends(),
    date_from: BusinessDateTime | None = Query(None, alias="from"),
    date_to: BusinessDateTime | None = Query(None, alias="to"),
    actor_id: int | None = Query(None, description="İşlemi yapan kullanıcı"),
    event_type: list[AuditEvent] = Query(default=[]),
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    """Denetim günlüğü (OWASP A09), en yeni önce: rol atama, kullanıcı ve müşteri durum değişikliği,
    ürün fiyatı ya da maliyeti değişikliği, sipariş iptali ve başarısız girişler."""
    filters = AuditFilters(date_from=date_from, date_to=date_to, actor_id=actor_id, event_types=event_type)
    logs, total = AuditRepository(db).list(filters, offset=page.offset, limit=page.page_size)
    items = [AuditLogOut.model_validate(log) for log in logs]
    return Page[AuditLogOut](items=items, total=total, page=page.page, page_size=page.page_size)
