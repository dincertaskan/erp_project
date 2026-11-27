"""Denetim günlüğüne kayıt yazar.

Kayıt, işlemin kendi veritabanı işlemine eklenir: işlem geri alınırsa günlük kaydı da yazılmaz, işlem
başarılıysa kaydı da kalıcıdır.
"""

from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditEvent, AuditLog, User


def _json(values: dict[str, Any] | None) -> dict[str, Any] | None:
    # Para değerleri JSON'da kayıpsız kalsın diye metin olarak saklanır.
    if values is None:
        return None
    return {key: str(value) if isinstance(value, Decimal) else value for key, value in values.items()}


def record(
    db: Session,
    event: AuditEvent,
    *,
    actor: User | None,
    entity_type: str,
    entity_id: int | None,
    entity_label: str | None,
    old: dict[str, Any] | None = None,
    new: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> None:
    db.add(
        AuditLog(
            event_type=event,
            actor_id=actor.id if actor is not None else None,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_label=entity_label,
            old_value=_json(old),
            new_value=_json(new),
            ip_address=ip_address,
        )
    )
