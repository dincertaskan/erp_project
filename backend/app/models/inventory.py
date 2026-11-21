from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.catalog import Product
from app.models.enums import StockMovementType, pg_enum
from app.models.user import User


class StockMovement(Base):
    """Stok miktarını değiştiren her işlemin değiştirilemez kaydı."""

    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("new_stock >= 0", name="new_stock_non_negative"),
        Index("ix_stock_movements_product_id_created_at", "product_id", "created_at"),
        Index("ix_stock_movements_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id", ondelete="RESTRICT"))
    movement_type: Mapped[StockMovementType] = mapped_column(pg_enum(StockMovementType, "stock_movement_type"))
    quantity: Mapped[int] = mapped_column(Integer)
    previous_stock: Mapped[int] = mapped_column(Integer)
    new_stock: Mapped[int] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped[Product] = relationship()
    user: Mapped[User] = relationship()
