from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.errors import AppError, ConflictError, NotFoundError
from app.models import Customer, RecordSource
from app.repositories.customer_repository import CustomerFilters, CustomerRepository
from app.repositories.order_repository import OrderFilters, OrderRepository
from app.schemas.common import Page, PageParams
from app.schemas.customer import (
    CustomerDetail,
    CustomerListItem,
    CustomerOrder,
    CustomerRequest,
    CustomerSort,
    CustomerStats,
)

EMAIL_TAKEN = "Bu e-posta adresiyle kayıtlı bir müşteri var."
EMAIL_LOCKED = "Müşterinin giriş hesabı olduğu için e-posta adresi değiştirilemez."


def _fields(customer: Customer) -> dict:
    return {
        "id": customer.id,
        "full_name": customer.full_name,
        "email": customer.email,
        "phone": customer.phone,
        "company_name": customer.company_name,
        "address": customer.address,
        "city": customer.city,
        "is_active": customer.is_active,
        "source": customer.source,
        "created_at": customer.created_at,
        "has_account": customer.user_id is not None,
    }


class CustomerService:
    """Müşteri kartları ve sipariş geçmişi (FR-11). Müşteriler silinmez, pasife alınır."""

    def __init__(self, db: Session):
        self.db = db
        self.customers = CustomerRepository(db)

    def list(
        self, page: PageParams, filters: CustomerFilters, *, sort: CustomerSort, descending: bool
    ) -> Page[CustomerListItem]:
        rows, total = self.customers.list(
            filters, sort=sort, descending=descending, offset=page.offset, limit=page.page_size
        )
        items = [
            CustomerListItem.model_validate(
                {
                    **_fields(customer),
                    "order_count": order_count,
                    "total_spent": total_spent,
                    "last_order_at": last_order_at,
                }
            )
            for customer, order_count, _revenue_count, total_spent, last_order_at in rows
        ]
        return Page[CustomerListItem](items=items, total=total, page=page.page, page_size=page.page_size)

    def _get(self, customer_id: int) -> Customer:
        customer = self.customers.get(customer_id)
        if customer is None:
            raise NotFoundError("Müşteri bulunamadı.")
        return customer

    def detail(self, customer_id: int) -> CustomerDetail:
        customer = self._get(customer_id)
        row = self.customers.stats(customer.id)
        order_count = row.order_count if row else 0
        revenue_count = row.revenue_order_count if row else 0
        total_spent = Decimal(row.total_spent) if row else Decimal("0")
        average = (total_spent / revenue_count).quantize(Decimal("0.01")) if revenue_count else Decimal("0")
        stats = CustomerStats(
            order_count=order_count,
            revenue_order_count=revenue_count,
            total_spent=total_spent,
            average_basket=average,
            last_order_at=row.last_order_at if row else None,
        )
        return CustomerDetail.model_validate(
            {
                **_fields(customer),
                "order_count": order_count,
                "total_spent": total_spent,
                "last_order_at": stats.last_order_at,
                "stats": stats,
            }
        )

    def _ensure_email_free(self, email: str, current_id: int | None = None) -> None:
        existing = self.customers.get_by_email(email)
        if existing is not None and existing.id != current_id:
            raise ConflictError(EMAIL_TAKEN, code="EMAIL_TAKEN", details=[{"field": "email", "message": EMAIL_TAKEN}])

    def create(self, data: CustomerRequest) -> CustomerDetail:
        self._ensure_email_free(data.email)
        # Yöneticinin eklediği müşterinin giriş hesabı yoktur; aynı e-postayla kayıt olunursa hesaba bağlanır.
        customer = Customer(**data.model_dump())
        self.db.add(customer)
        self.db.commit()
        return self.detail(customer.id)

    def update(self, customer_id: int, data: CustomerRequest) -> CustomerDetail:
        customer = self._get(customer_id)
        if customer.source == RecordSource.OLIST:
            raise AppError("Olist verisinden aktarılan müşteriler düzenlenemez.", code="READ_ONLY")
        if customer.user_id is not None and data.email != customer.email.lower():
            raise AppError(EMAIL_LOCKED, code="EMAIL_LOCKED", details=[{"field": "email", "message": EMAIL_LOCKED}])
        self._ensure_email_free(data.email, customer.id)

        for key, value in data.model_dump().items():
            setattr(customer, key, value)
        # Hesabı olan müşterinin adı giriş hesabıyla aynı tutulur (profil ekranı da iki yönlü günceller).
        if customer.user is not None:
            customer.user.full_name = customer.full_name
        self.db.commit()
        return self.detail(customer.id)

    def set_status(self, customer_id: int, is_active: bool) -> CustomerDetail:
        customer = self._get(customer_id)
        customer.is_active = is_active
        self.db.commit()
        return self.detail(customer.id)

    def orders(self, customer_id: int, page: PageParams, filters: OrderFilters) -> Page[CustomerOrder]:
        customer = self._get(customer_id)
        filters.customer_id = customer.id
        rows, total = OrderRepository(self.db).list(filters, offset=page.offset, limit=page.page_size)
        items = [
            CustomerOrder(
                id=order.id,
                order_code=order.order_code,
                created_at=order.created_at,
                item_count=item_count,
                total_amount=order.total_amount,
                status=order.status,
            )
            for order, item_count in rows
        ]
        return Page[CustomerOrder](items=items, total=total, page=page.page, page_size=page.page_size)

    def cities(self) -> list[str]:
        return self.customers.cities()
