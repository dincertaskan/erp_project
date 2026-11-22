from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import Session

from app.models import Customer, Order, OrderStatus
from app.schemas.customer import CustomerSort

# Karar 6: ciroya yalnızca onaylanmış ve iptal edilmemiş siparişler girer.
REVENUE_STATUSES = (OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.COMPLETED)


@dataclass
class CustomerFilters:
    search: str | None = None
    city: str | None = None
    is_active: bool | None = None
    has_account: bool | None = None


def _order_stats():
    """Müşteri başına sipariş istatistikleri; tek bir toplama sorgusu (N+1 yok)."""
    is_revenue = Order.status.in_(REVENUE_STATUSES)
    return (
        select(
            Order.customer_id.label("customer_id"),
            func.count().label("order_count"),
            func.count().filter(is_revenue).label("revenue_order_count"),
            func.coalesce(func.sum(Order.total_amount).filter(is_revenue), 0).label("total_spent"),
            func.max(Order.created_at).label("last_order_at"),
        )
        .group_by(Order.customer_id)
        .subquery()
    )


class CustomerRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, customer_id: int) -> Customer | None:
        return self.db.get(Customer, customer_id)

    def get_by_email(self, email: str) -> Customer | None:
        return self.db.scalar(select(Customer).where(func.lower(Customer.email) == email.lower()))

    def _filtered(self, query: Select, filters: CustomerFilters) -> Select:
        if filters.search:
            pattern = f"%{filters.search}%"
            query = query.where(
                or_(
                    Customer.full_name.ilike(pattern),
                    Customer.email.ilike(pattern),
                    Customer.phone.ilike(pattern),
                    Customer.company_name.ilike(pattern),
                )
            )
        if filters.city:
            query = query.where(Customer.city.ilike(filters.city))
        if filters.is_active is not None:
            query = query.where(Customer.is_active.is_(filters.is_active))
        if filters.has_account is not None:
            query = query.where(Customer.user_id.isnot(None) if filters.has_account else Customer.user_id.is_(None))
        return query

    def list(
        self, filters: CustomerFilters, *, sort: CustomerSort, descending: bool, offset: int, limit: int
    ) -> tuple[list[tuple[Customer, int, int, object, object]], int]:
        stats = _order_stats()
        query = self._filtered(select(Customer), filters)
        total = self.db.scalar(select(func.count()).select_from(query.subquery()))
        columns = {
            CustomerSort.FULL_NAME: Customer.full_name,
            CustomerSort.CREATED_AT: Customer.created_at,
            CustomerSort.ORDER_COUNT: func.coalesce(stats.c.order_count, 0),
            CustomerSort.TOTAL_SPENT: func.coalesce(stats.c.total_spent, 0),
            CustomerSort.LAST_ORDER_AT: stats.c.last_order_at,
        }
        column = columns[sort]
        order = column.desc().nulls_last() if descending else column.asc().nulls_first()
        rows = self.db.execute(
            query.add_columns(
                func.coalesce(stats.c.order_count, 0),
                func.coalesce(stats.c.revenue_order_count, 0),
                func.coalesce(stats.c.total_spent, 0),
                stats.c.last_order_at,
            )
            .outerjoin(stats, and_(stats.c.customer_id == Customer.id))
            .order_by(order, Customer.id)
            .offset(offset)
            .limit(limit)
        ).all()
        return [tuple(row) for row in rows], total

    def stats(self, customer_id: int):
        stats = _order_stats()
        return self.db.execute(select(stats).where(stats.c.customer_id == customer_id)).first()

    def cities(self) -> list[str]:
        return list(
            self.db.scalars(
                select(Customer.city).where(Customer.city.isnot(None)).distinct().order_by(Customer.city)
            ).all()
        )
