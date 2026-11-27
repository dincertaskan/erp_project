from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.user import User


class AuditEvent(StrEnum):
    ROLE_CHANGED = "role_changed"
    USER_STATUS_CHANGED = "user_status_changed"
    CUSTOMER_STATUS_CHANGED = "customer_status_changed"
    PRODUCT_PRICE_CHANGED = "product_price_changed"
    ORDER_CANCELLED = "order_cancelled"
    LOGIN_FAILED = "login_failed"


class AuditLog(Base):
    """Yönetim işlemleri ve başarısız girişler için denetim günlüğü (OWASP A09).

    Kayıtlar değiştirilmez ve silinmez. entity_label, kaydın o anki okunur adıdır (e-posta, SKU, sipariş kodu);
    kayıt sonradan değişse de günlük okunur kalır. Başarısız girişlerde işlemi yapan bilinmez (actor_id boş);
    denenen e-posta entity_label'da, istemci adresi ip_address'te tutulur.
    """

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_created_at", "created_at"),
        Index("ix_audit_logs_event_type_created_at", "event_type", "created_at"),
        Index("ix_audit_logs_actor_id_created_at", "actor_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    event_type: Mapped[AuditEvent] = mapped_column(String(40))
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    entity_type: Mapped[str] = mapped_column(String(20))
    entity_id: Mapped[int | None] = mapped_column(Integer)
    entity_label: Mapped[str | None] = mapped_column(String(255))
    old_value: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    new_value: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(String(45))

    actor: Mapped[User | None] = relationship()
