from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import AppError, ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from app.models import (
    Customer,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusHistory,
    Product,
    RecordSource,
    StockMovementType,
    User,
    UserRole,
)
from app.repositories.order_repository import OrderFilters, OrderRepository
from app.schemas.common import PageParams
from app.schemas.order import (
    OrderAction,
    OrderCreateRequest,
    OrderDetail,
    OrderListItem,
    OrderMovementOut,
    OrderPage,
    Shortage,
)
from app.services.stock_ledger import (
    InsufficientStockError,
    apply_movement,
    commit_stock_changes,
    lock_products,
    shortage,
    with_retry,
)


@dataclass(frozen=True)
class Transition:
    sources: frozenset[OrderStatus]
    target: OrderStatus
    roles: frozenset[UserRole]


# Sipariş durum makinesi (FR-13, FR-14). Tamamlanan ve iptal edilen siparişler son durumdur.
TRANSITIONS: dict[OrderAction, Transition] = {
    OrderAction.APPROVE: Transition(
        frozenset({OrderStatus.PENDING}), OrderStatus.PREPARING, frozenset({UserRole.ADMIN})
    ),
    OrderAction.SHIP: Transition(
        frozenset({OrderStatus.PREPARING}), OrderStatus.SHIPPED, frozenset({UserRole.ADMIN, UserRole.WAREHOUSE})
    ),
    OrderAction.COMPLETE: Transition(
        frozenset({OrderStatus.SHIPPED}), OrderStatus.COMPLETED, frozenset({UserRole.ADMIN})
    ),
    OrderAction.CANCEL: Transition(
        frozenset({OrderStatus.PENDING, OrderStatus.PREPARING}), OrderStatus.CANCELLED, frozenset({UserRole.ADMIN})
    ),
}

# Depo personeli yalnızca uygulamada oluşturulmuş, hazırlanan ve kargolanan siparişleri görür. Olist'ten
# aktarılan açık siparişler salt okunur olduğu için depo iş kuyruğuna girmez.
WAREHOUSE_STATUSES = frozenset({OrderStatus.PREPARING, OrderStatus.SHIPPED})

TIMESTAMP_FIELDS = {
    OrderStatus.PREPARING: "approved_at",
    OrderStatus.SHIPPED: "shipped_at",
    OrderStatus.COMPLETED: "completed_at",
    OrderStatus.CANCELLED: "cancelled_at",
}


# Tutar sütunları Numeric(12, 2): bu değeri aşan tutar veritabanında taşma hatası verir.
MAX_AMOUNT = Decimal("9999999999.99")


def ensure_amounts_fit(line_totals: list[Decimal]) -> None:
    """Satır tutarları istekteki sırayla verilir; hata alanı istekteki satırı gösterir."""
    errors = [
        {"field": f"items.{index}.quantity", "message": "Satır tutarı izin verilen üst sınırı aşıyor."}
        for index, line_total in enumerate(line_totals)
        if line_total > MAX_AMOUNT
    ]
    if not errors and sum(line_totals, Decimal("0")) > MAX_AMOUNT:
        errors.append({"field": "items", "message": "Sipariş toplamı izin verilen üst sınırı aşıyor."})
    if errors:
        raise UnprocessableError(errors)


def allowed_actions(order: Order, role: UserRole) -> list[OrderAction]:
    # Olist'ten aktarılan geçmiş siparişler salt okunurdur (karar 14: stok hareketi oluşturmaz).
    if order.source == RecordSource.OLIST:
        return []
    return [
        action
        for action, transition in TRANSITIONS.items()
        if order.status in transition.sources and role in transition.roles
    ]


def visible_statuses(viewer: User) -> frozenset[OrderStatus] | None:
    return WAREHOUSE_STATUSES if viewer.role == UserRole.WAREHOUSE else None


def compose_address(customer: Customer) -> str | None:
    parts = [part for part in (customer.address, customer.city) if part]
    return ", ".join(parts) or None


class OrderService:
    """Panelden sipariş yönetimi: oluşturma (FR-12), listeleme ve durum geçişleri (FR-13, FR-14, FR-15)."""

    def __init__(self, db: Session):
        self.db = db
        self.orders = OrderRepository(db)

    # --- Okuma ---

    def list(self, viewer: User, page: PageParams, filters: OrderFilters) -> OrderPage:
        visible = visible_statuses(viewer)
        if visible is not None:
            filters.statuses = visible & set(filters.statuses) if filters.statuses is not None else visible
            filters.source = RecordSource.APP
        rows, total = self.orders.list(filters, offset=page.offset, limit=page.page_size)
        counts = self.orders.counts_by_status(filters)
        if visible is not None:
            counts = {status: count for status, count in counts.items() if status in visible}
        items = [
            OrderListItem.model_validate(
                {
                    **_order_fields(order),
                    "item_count": item_count,
                    "allowed_actions": allowed_actions(order, viewer.role),
                }
            )
            for order, item_count in rows
        ]
        return OrderPage(items=items, total=total, page=page.page, page_size=page.page_size, counts_by_status=counts)

    def detail(self, viewer: User, order_id: int) -> OrderDetail:
        order = self.orders.get_detail(order_id)
        if order is None:
            raise NotFoundError("Sipariş bulunamadı.")
        visible = visible_statuses(viewer)
        if visible is not None and (order.status not in visible or order.source != RecordSource.APP):
            raise ForbiddenError("Bu siparişi görüntüleme yetkiniz yok.")

        shortages = []
        if order.status == OrderStatus.PENDING:
            shortages = [
                Shortage.model_validate(shortage(item.product, item.quantity))
                for item in order.items
                if item.quantity > item.product.stock
            ]
        return OrderDetail.model_validate(
            {
                **_order_fields(order),
                "customer": order.customer,
                "shipping_address": order.shipping_address,
                "note": order.note,
                "created_by": order.created_by,
                "approved_at": order.approved_at,
                "shipped_at": order.shipped_at,
                "completed_at": order.completed_at,
                "cancelled_at": order.cancelled_at,
                "item_count": len(order.items),
                "items": order.items,
                "history": order.history,
                "movements": [OrderMovementOut.model_validate(m) for m in self.orders.movements(order.id)],
                "shortages": shortages,
                "allowed_actions": allowed_actions(order, viewer.role),
            }
        )

    # --- Oluşturma ---

    def create(self, actor: User, data: OrderCreateRequest) -> OrderDetail:
        customer = self.db.get(Customer, data.customer_id)
        if customer is None:
            raise AppError(
                "Müşteri bulunamadı.",
                code="CUSTOMER_NOT_FOUND",
                details=[{"field": "customer_id", "message": "Müşteri bulunamadı."}],
            )
        if not customer.is_active:
            raise AppError("Pasif müşteri adına sipariş oluşturulamaz.", code="CUSTOMER_INACTIVE")

        ids = [i.product_id for i in data.items]
        products = {p.id: p for p in self.db.scalars(select(Product).where(Product.id.in_(ids)))}
        missing = [i.product_id for i in data.items if i.product_id not in products]
        if missing:
            raise AppError("Ürün bulunamadı.", code="PRODUCT_NOT_FOUND", details={"product_ids": missing})
        inactive = [products[i.product_id].name for i in data.items if not products[i.product_id].is_active]
        if inactive:
            raise AppError(
                f"Pasif ürünler siparişe eklenemez: {', '.join(inactive)}.",
                code="PRODUCT_INACTIVE",
                details={"products": inactive},
            )

        ensure_amounts_fit([products[i.product_id].sale_price * i.quantity for i in data.items])

        order = Order(
            order_code=self.orders.next_code(clock.now().year),
            customer=customer,
            status=OrderStatus.PENDING,
            payment_method=data.payment_method,
            shipping_address=data.shipping_address or compose_address(customer),
            note=data.note or None,
            created_by_id=actor.id,
            total_amount=Decimal("0"),
        )
        # Fiyat her zaman sunucuda okunur; istemciden fiyat alınmaz. Stok burada düşülmez (karar 3: onayda).
        for item in data.items:
            product = products[item.product_id]
            line_total = product.sale_price * item.quantity
            order.items.append(
                OrderItem(product=product, quantity=item.quantity, unit_price=product.sale_price, line_total=line_total)
            )
            order.total_amount += line_total
        order.history.append(
            OrderStatusHistory(from_status=None, to_status=OrderStatus.PENDING, changed_by_id=actor.id)
        )
        self.db.add(order)
        self.db.commit()
        return self.detail(actor, order.id)

    # --- Durum geçişleri ---

    def transition(self, actor: User, order_id: int, action: OrderAction) -> OrderDetail:
        with_retry(self.db, lambda: self._transition(actor, order_id, action))
        return self.detail(actor, order_id)

    def _transition(self, actor: User, order_id: int, action: OrderAction) -> None:
        order = self.orders.lock(order_id)
        if order is None:
            raise NotFoundError("Sipariş bulunamadı.")
        transition = TRANSITIONS[action]
        if actor.role not in transition.roles:
            raise ForbiddenError("Bu işlem için yetkiniz yok.")
        if action not in allowed_actions(order, actor.role):
            raise ConflictError("Sipariş bu durumdayken bu işlem yapılamaz.", code="INVALID_TRANSITION")

        previous = order.status
        if action == OrderAction.APPROVE:
            self._deduct_stock(actor, order)
        elif action == OrderAction.CANCEL and previous == OrderStatus.PREPARING:
            self._return_stock(actor, order)

        order.status = transition.target
        setattr(order, TIMESTAMP_FIELDS[transition.target], datetime.now(UTC))
        order.history.append(
            OrderStatusHistory(from_status=previous, to_status=transition.target, changed_by_id=actor.id)
        )
        commit_stock_changes(self.db)

    def _deduct_stock(self, actor: User, order: Order) -> None:
        """Onay tek işlemde yapılır: bir kalemde bile stok yetmezse hiçbir şey değişmez ve tüm eksikler bildirilir."""
        products = lock_products(self.db, [item.product_id for item in order.items])
        shortages = [
            shortage(products[item.product_id], item.quantity)
            for item in order.items
            if item.quantity > products[item.product_id].stock
        ]
        if shortages:
            raise InsufficientStockError(shortages)
        for item in order.items:
            apply_movement(
                self.db,
                products[item.product_id],
                movement_type=StockMovementType.ORDER_OUT,
                quantity=item.quantity,
                user_id=actor.id,
                order_id=order.id,
                description=f"{order.order_code} siparişi onaylandı",
            )

    def _return_stock(self, actor: User, order: Order) -> None:
        products = lock_products(self.db, [item.product_id for item in order.items])
        for item in order.items:
            apply_movement(
                self.db,
                products[item.product_id],
                movement_type=StockMovementType.CANCEL_RETURN,
                quantity=item.quantity,
                user_id=actor.id,
                order_id=order.id,
                description=f"{order.order_code} siparişi iptal edildi",
            )


def _order_fields(order: Order) -> dict:
    return {
        "id": order.id,
        "order_code": order.order_code,
        "created_at": order.created_at,
        "status": order.status,
        "customer": order.customer,
        "total_amount": order.total_amount,
        "payment_method": order.payment_method,
        "source": order.source,
    }
