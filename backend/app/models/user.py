from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.models.enums import RecordSource, UserRole, pg_enum


class User(TimestampMixin, Base):
    """Sisteme giriş yapan her hesap. Rol; yönetici, depo personeli veya müşteri olabilir."""

    __tablename__ = "users"
    # E-posta büyük/küçük harf duyarsız benzersizdir (giriş ve kayıt da lower() ile arar).
    __table_args__ = (Index("uq_users_email_lower", text("lower(email)"), unique=True),)

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(pg_enum(UserRole, "user_role"), default=UserRole.CUSTOMER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Kullanıcıyla birlikte yüklenir: oturum yanıt serileştirilmeden kapandığı için sonradan yüklenemez.
    customer: Mapped["Customer | None"] = relationship(back_populates="user", lazy="joined")


class Customer(TimestampMixin, Base):
    """Müşteri kartı. Portal hesabı varsa bir kullanıcıya bağlıdır; yöneticinin eklediği müşterilerde boş kalır."""

    __tablename__ = "customers"
    __table_args__ = (Index("uq_customers_email_lower", text("lower(email)"), unique=True),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), unique=True)
    full_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30))
    company_name: Mapped[str | None] = mapped_column(String(150))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    source: Mapped[RecordSource] = mapped_column(
        pg_enum(RecordSource, "record_source"), default=RecordSource.APP, server_default=RecordSource.APP.value
    )
    external_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    # Kayıtta bu karta bağlanmak için yöneticinin ürettiği tek kullanımlık davet kodu (app.core.invite_codes).
    # Kodun kendisi saklanmaz, yalnızca özeti; kullanıldığında ya da yenisi üretildiğinde eskisi geçersizleşir.
    invite_code_digest: Mapped[str | None] = mapped_column(String(64))
    invite_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User | None] = relationship(back_populates="customer")


class LoginAttempt(Base):
    """Hatalı giriş denemesi. Giriş sınırı (app.services.login_throttle) e-posta ve IP başına bunları sayar.

    Sayaç veritabanında tutulduğu için uygulama yeniden başlayınca korunur ve tüm uvicorn süreçleri aynı sayacı görür.
    Pencereden eski kayıtlar yeni deneme yazılırken silinir.
    """

    __tablename__ = "login_attempts"
    __table_args__ = (
        Index("ix_login_attempts_email_created_at", "email", "created_at"),
        Index("ix_login_attempts_ip_address_created_at", "ip_address", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    email: Mapped[str] = mapped_column(String(255))
    ip_address: Mapped[str] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
