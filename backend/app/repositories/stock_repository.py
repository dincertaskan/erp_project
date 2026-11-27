from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Float, and_, cast, func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Order, Product, StockMovement, StockMovementType
from app.repositories.search import contains_pattern
from app.schemas.stock import MovementFilters

# Stok durumu tanımlarının tek kaynağı. Dashboard sayacı, menü rozeti, kritik stok sayfası ve ürün
# listesindeki stok filtresi bunları kullanır; ekrandaki etiketi üreten schemas.catalog.stock_status
# aynı kuralı Python'da uygular (testle eşitliği sınanır).
#   Tükendi: stok = 0
#   Kritik:  0 < stok < minimum
#   Yeterli: stok > 0 ve stok >= minimum
OUT_OF_STOCK = Product.stock <= 0
CRITICAL = and_(Product.stock > 0, Product.stock < Product.min_stock)
SUFFICIENT = and_(Product.stock > 0, Product.stock >= Product.min_stock)


class StockRepository:
    def __init__(self, db: Session):
        self.db = db

    def movements(self, filters: MovementFilters, *, offset: int, limit: int) -> tuple[list[StockMovement], int]:
        query = select(StockMovement)
        if filters.date_from is not None:
            query = query.where(StockMovement.created_at >= filters.date_from)
        if filters.date_to is not None:
            query = query.where(StockMovement.created_at <= filters.date_to)
        if filters.product_id is not None:
            query = query.where(StockMovement.product_id == filters.product_id)
        if filters.types:
            query = query.where(StockMovement.movement_type.in_(filters.types))
        if filters.user_id is not None:
            query = query.where(StockMovement.user_id == filters.user_id)
        if filters.order_code:
            query = query.join(Order, Order.id == StockMovement.order_id).where(
                Order.order_code.ilike(contains_pattern(filters.order_code))
            )
        total = self.db.scalar(select(func.count()).select_from(query.subquery()))
        items = self.db.scalars(
            query.options(
                joinedload(StockMovement.product), joinedload(StockMovement.user), joinedload(StockMovement.order)
            )
            .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
            .offset(offset)
            .limit(limit)
        ).all()
        return list(items), total

    def critical(self, *, category_ids: Sequence[int], offset: int, limit: int) -> tuple[list[Product], int]:
        query = select(Product).where(Product.is_active.is_(True), CRITICAL)
        if category_ids:
            query = query.where(Product.category_id.in_(category_ids))
        total = self.db.scalar(select(func.count()).select_from(query.subquery()))
        # En kritik önce: stok / minimum oranı küçük olan üstte (min_stock > stock > 0 olduğundan sıfıra bölünmez).
        ratio = cast(Product.stock, Float) / Product.min_stock
        products = self.db.scalars(
            query.options(joinedload(Product.category)).order_by(ratio, Product.name).offset(offset).limit(limit)
        ).all()
        return list(products), total

    def critical_count(self) -> int:
        return self.db.scalar(select(func.count()).where(Product.is_active.is_(True), CRITICAL))

    def active_product_count(self) -> int:
        return self.db.scalar(select(func.count()).where(Product.is_active.is_(True)))

    def movement_count_since(self, since: datetime) -> int:
        return self.db.scalar(select(func.count()).where(StockMovement.created_at >= since))

    def sold_since(self, product_ids: Sequence[int], since: datetime) -> dict[int, int]:
        if not product_ids:
            return {}
        rows = self.db.execute(
            select(StockMovement.product_id, func.sum(StockMovement.quantity))
            .where(
                StockMovement.product_id.in_(product_ids),
                StockMovement.movement_type == StockMovementType.ORDER_OUT,
                StockMovement.created_at >= since,
            )
            .group_by(StockMovement.product_id)
        ).all()
        return {product_id: int(total) for product_id, total in rows}

    def last_movement_at(self, product_ids: Sequence[int]) -> dict[int, datetime]:
        if not product_ids:
            return {}
        rows = self.db.execute(
            select(StockMovement.product_id, func.max(StockMovement.created_at))
            .where(StockMovement.product_id.in_(product_ids))
            .group_by(StockMovement.product_id)
        ).all()
        return dict(rows)
