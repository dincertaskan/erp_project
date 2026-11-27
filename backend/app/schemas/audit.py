from datetime import datetime
from typing import Any

from app.models import AuditEvent
from app.schemas.common import ApiModel


class AuditActor(ApiModel):
    id: int
    full_name: str
    email: str


class AuditLogOut(ApiModel):
    id: int
    created_at: datetime
    event_type: AuditEvent
    # Başarısız girişlerde boştur; denenen e-posta entity_label'dadır.
    actor: AuditActor | None
    entity_type: str
    entity_id: int | None
    entity_label: str | None
    old_value: dict[str, Any] | None
    new_value: dict[str, Any] | None
    ip_address: str | None


class AuditFilters(ApiModel):
    date_from: datetime | None = None
    date_to: datetime | None = None
    actor_id: int | None = None
    event_types: list[AuditEvent] = []
