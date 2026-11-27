from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, Numeric, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.models.enums import RecordSource, pg_enum


class Category(TimestampMixin, Base):
    __tablename__ = "categories"
    __table_args__ = (Index("uq_categories_name_lower", text("lower(name)"), unique=True),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    color: Mapped[str] = mapped_column(String(7), default="#4F46E5", server_default="#4F46E5")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("stock >= 0", name="stock_non_negative"),
        CheckConstraint("min_stock >= 0", name="min_stock_non_negative"),
        CheckConstraint("sale_price >= 0", name="sale_price_non_negative"),
        CheckConstraint("cost_price >= 0", name="cost_price_non_negative"),
        Index("ix_products_category_id", "category_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    sale_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    cost_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), server_default="0")
    stock: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    min_stock: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    image_url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    # İyimser kilit stratejisi (Deney 1) için sürüm numarası
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    source: Mapped[RecordSource] = mapped_column(
        pg_enum(RecordSource, "record_source"), default=RecordSource.APP, server_default=RecordSource.APP.value
    )
    external_id: Mapped[str | None] = mapped_column(String(64), unique=True)

    category: Mapped[Category] = relationship(back_populates="products")

    # Her UPDATE "WHERE version = ?" ile yapılır ve sürümü artırır; araya başka bir yazma girdiyse
    # StaleDataError oluşur. İyimser kilit stratejisi bu davranışa dayanır.
    __mapper_args__ = {"version_id_col": version}
