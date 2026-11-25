from __future__ import annotations

from collections.abc import Collection
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Customer, Order, OrderItem, OrderStatus, OrderStatusHistory, RecordSource, StockMovement
from app.models.order import ORDER_CODE_SEQUENCE


def item_count_column():
    """Sipariş başına kalem sayısı; ilişkili alt sorgu yalnızca sayfadaki satırlar için çalışır."""
    return (
        select(func.count())
        .where(OrderItem.order_id == Order.id)
        .correlate(Order)
        .scalar_subquery()
        .label("item_count")
    )


@dataclass
class OrderFilters:
    statuses: Collection[OrderStatus] | None = None
    search: str | None = None
    customer_id: int | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    source: RecordSource | None = None


class OrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def next_code(self, year: int) -> str:
        """SIP-2026-000123: yıl ve veritabanı dizisinden gelen sıra numarası."""
        return f"SIP-{year}-{self.db.scalar(select(ORDER_CODE_SEQUENCE.next_value())):06d}"

    def _filtered(self, query: Select, filters: OrderFilters, *, with_status: bool = True) -> Select:
        if with_status and filters.statuses is not None:
            query = query.where(Order.status.in_(filters.statuses))
        if filters.search:
            pattern = f"%{filters.search}%"
            query = query.join(Customer, Customer.id == Order.customer_id).where(
                or_(Order.order_code.ilike(pattern), Customer.full_name.ilike(pattern))
            )
        if filters.customer_id is not None:
            query = query.where(Order.customer_id == filters.customer_id)
        if filters.source is not None:
            query = query.where(Order.source == filters.source)
        if filters.date_from is not None:
            query = query.where(Order.created_at >= filters.date_from)
        if filters.date_to is not None:
            query = query.where(Order.created_at <= filters.date_to)
        return query

    def list(self, filters: OrderFilters, *, offset: int, limit: int) -> tuple[list[tuple[Order, int]], int]:
        query = self._filtered(select(Order), filters)
        total = self.db.scalar(select(func.count()).select_from(query.subquery()))
        rows = self.db.execute(
            query.add_columns(item_count_column())
            .options(joinedload(Order.customer))
            .order_by(Order.created_at.desc(), Order.id.desc())
            .offset(offset)
            .limit(limit)
        ).all()
        return [(row[0], row[1]) for row in rows], total

    def counts_by_status(self, filters: OrderFilters) -> dict[OrderStatus, int]:
        """Durum sekmelerindeki sayılar: durum dışındaki filtreler uygulanır."""
        query = self._filtered(select(Order.status, func.count()), filters, with_status=False).group_by(Order.status)
        return dict(self.db.execute(query).all())

    def get_detail(self, order_id: int) -> Order | None:
        return self.db.scalar(
            select(Order)
            .options(
                joinedload(Order.customer),
                joinedload(Order.created_by),
                selectinload(Order.items).joinedload(OrderItem.product),
                selectinload(Order.history).joinedload(OrderStatusHistory.changed_by),
            )
            .where(Order.id == order_id)
        )

    def lock(self, order_id: int) -> Order | None:
        """Aynı siparişe gelen eşzamanlı geçişler (ör. iki kez onay) sırayla çalışır."""
        return self.db.scalar(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.id == order_id)
            .with_for_update(of=Order)
            .execution_options(populate_existing=True)
        )

    def movements(self, order_id: int) -> list[StockMovement]:
        return list(
            self.db.scalars(
                select(StockMovement)
                .options(
                    joinedload(StockMovement.product),
                    joinedload(StockMovement.user),
                    joinedload(StockMovement.order),
                )
                .where(StockMovement.order_id == order_id)
                .order_by(StockMovement.created_at, StockMovement.id)
            ).all()
        )
