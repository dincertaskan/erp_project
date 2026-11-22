from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.models.enums import RecordSource, UserRole, pg_enum


class User(TimestampMixin, Base):
    """Sisteme giriş yapan her hesap. Rol; yönetici, depo personeli veya müşteri olabilir."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(pg_enum(UserRole, "user_role"), default=UserRole.CUSTOMER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Kullanıcıyla birlikte yüklenir: oturum yanıt serileştirilmeden kapandığı için sonradan yüklenemez.
    customer: Mapped["Customer | None"] = relationship(back_populates="user", lazy="joined")


class Customer(TimestampMixin, Base):
    """Müşteri kartı. Portal hesabı varsa bir kullanıcıya bağlıdır; yöneticinin eklediği müşterilerde boş kalır."""

    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), unique=True)
    full_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    phone: Mapped[str | None] = mapped_column(String(30))
    company_name: Mapped[str | None] = mapped_column(String(150))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    source: Mapped[RecordSource] = mapped_column(
        pg_enum(RecordSource, "record_source"), default=RecordSource.APP, server_default=RecordSource.APP.value
    )
    external_id: Mapped[str | None] = mapped_column(String(64), unique=True)

    user: Mapped[User | None] = relationship(back_populates="customer")
