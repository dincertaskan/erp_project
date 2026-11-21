from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Sequence,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.models.catalog import Product
from app.models.enums import OrderStatus, PaymentMethod, RecordSource, pg_enum
from app.models.user import Customer, User

# Sipariş kodundaki sıra numarası (SIP-2026-000123); eşzamanlı oluşturmalarda çakışmaz.
ORDER_CODE_SEQUENCE = Sequence("order_code_seq", metadata=Base.metadata)


class Order(TimestampMixin, Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("total_amount >= 0", name="total_amount_non_negative"),
        Index("ix_orders_created_at", "created_at"),
        Index("ix_orders_customer_id", "customer_id"),
        Index("ix_orders_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_code: Mapped[str] = mapped_column(String(40), unique=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"))
    status: Mapped[OrderStatus] = mapped_column(
        pg_enum(OrderStatus, "order_status"), default=OrderStatus.PENDING, server_default=OrderStatus.PENDING.value
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    payment_method: Mapped[PaymentMethod] = mapped_column(pg_enum(PaymentMethod, "payment_method"))
    shipping_address: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    # Durum tarihleri raporlar ve Olist verisi için siparişte de tutulur; işlemi yapan kişi geçmiş tablosundadır.
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source: Mapped[RecordSource] = mapped_column(
        pg_enum(RecordSource, "record_source"), default=RecordSource.APP, server_default=RecordSource.APP.value
    )
    external_id: Mapped[str | None] = mapped_column(String(64), unique=True)

    customer: Mapped[Customer] = relationship()
    created_by: Mapped[User | None] = relationship()
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.id"
    )
    history: Mapped[list["OrderStatusHistory"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderStatusHistory.id"
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("unit_price >= 0", name="unit_price_non_negative"),
        UniqueConstraint("order_id", "product_id", name="uq_order_items_order_product"),
        Index("ix_order_items_order_id", "order_id"),
        Index("ix_order_items_product_id", "product_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"))
    quantity: Mapped[int] = mapped_column(Integer)
    # Sipariş anındaki satış fiyatının kopyası; ürün fiyatı sonradan değişse de değişmez.
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    order: Mapped[Order] = relationship(back_populates="items")
    product: Mapped[Product] = relationship()


class OrderStatusHistory(Base):
    """Sipariş durum geçişlerinin kim tarafından ve ne zaman yapıldığının kaydı."""

    __tablename__ = "order_status_history"
    __table_args__ = (Index("ix_order_status_history_order_id", "order_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    from_status: Mapped[OrderStatus | None] = mapped_column(pg_enum(OrderStatus, "order_status"))
    to_status: Mapped[OrderStatus] = mapped_column(pg_enum(OrderStatus, "order_status"))
    changed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    order: Mapped[Order] = relationship(back_populates="history")
    changed_by: Mapped[User | None] = relationship()
