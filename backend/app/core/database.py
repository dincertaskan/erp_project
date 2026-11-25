from datetime import datetime

from sqlalchemy import DateTime, MetaData, create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from starlette.concurrency import run_in_threadpool

from app.core.config import settings

# Alembic göçlerinde kısıt adlarının her ortamda aynı olması için adlandırma kuralı
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


async def get_db():
    # Async: kapanış iş parçacığı beklemez. Okuma işlemleri uç nokta dönerken SessionReleasingRoute ile
    # kapatılır (bkz. app/core/routing.py); burada kalan bağlantı varsa havuza döner.
    db = SessionLocal()
    try:
        yield db
    finally:
        if db.in_transaction():
            # Hata yolunda işlem açık kalır; kapanıştaki ROLLBACK ağ beklemesi olay döngüsünü durdurmasın.
            await run_in_threadpool(db.close)
        else:
            db.close()
