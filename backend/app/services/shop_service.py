from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core import clock
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.models import Category, Customer, Order, OrderItem, OrderStatus, OrderStatusHistory, Product, User
from app.repositories.order_repository import OrderRepository
from app.schemas.common import PageParams
from app.schemas.shop import (
    CartIssue,
    CartIssueType,
    CartLine,
    CartValidation,
    CatalogCategory,
    CatalogPage,
    CatalogProduct,
    CatalogProductDetail,
    CatalogSort,
    MyOrderDetail,
    MyOrderItem,
    MyOrderSummary,
    MyStatusStep,
    ShopOrderRequest,
    StatusGroup,
    availability,
)

# Karar 11: pasif kategorideki ürünler katalogda görünmez.
VISIBLE = (Product.is_active.is_(True), Category.is_active.is_(True))

STATUS_GROUPS = {
    StatusGroup.ACTIVE: (OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.SHIPPED),
    StatusGroup.COMPLETED: (OrderStatus.COMPLETED,),
    StatusGroup.CANCELLED: (OrderStatus.CANCELLED,),
}

SORTS = {
    CatalogSort.RECOMMENDED: (Product.stock <= 0, Product.name),  # stokta olanlar önce
    CatalogSort.PRICE_ASC: (Product.sale_price, Product.name),
    CatalogSort.PRICE_DESC: (Product.sale_price.desc(), Product.name),
    CatalogSort.NEWEST: (Product.created_at.desc(), Product.id.desc()),
    CatalogSort.NAME: (Product.name,),
}

PREVIEW_ITEMS = 3


def catalog_product(product: Product) -> CatalogProduct:
    return CatalogProduct(
        id=product.id,
        sku=product.sku,
        name=product.name,
        description=product.description,
        category=product.category,
        sale_price=product.sale_price,
        image_url=product.image_url,
        availability=availability(product.stock),
        available_qty=max(product.stock, 0),
    )


def _item(item: OrderItem) -> MyOrderItem:
    return MyOrderItem(
        product_id=item.product_id,
        sku=item.product.sku,
        name=item.product.name,
        image_url=item.product.image_url,
        quantity=item.quantity,
        unit_price=item.unit_price,
        line_total=item.line_total,
    )


class CatalogService:
    """Müşteri kataloğu (E-30, E-31): yalnızca aktif kategorilerdeki aktif ürünler, maliyet olmadan."""

    def __init__(self, db: Session):
        self.db = db

    def _visible(self) -> Select:
        return select(Product).join(Category, Category.id == Product.category_id).where(*VISIBLE)

    def categories(self) -> list[CatalogCategory]:
        rows = self.db.execute(
            select(Category, func.count(Product.id))
            .join(Product, Product.category_id == Category.id)
            .where(*VISIBLE)
            .group_by(Category.id)
            .order_by(Category.name)
        ).all()
        return [CatalogCategory(id=c.id, name=c.name, color=c.color, product_count=count) for c, count in rows]

    def products(
        self,
        page: PageParams,
        *,
        search: str | None,
        category_id: int | None,
        min_price: Decimal | None,
        max_price: Decimal | None,
        in_stock: bool,
        sort: CatalogSort,
    ) -> CatalogPage:
        query = self._visible()
        if search:
            pattern = f"%{search}%"
            query = query.where(or_(Product.name.ilike(pattern), Product.sku.ilike(pattern)))
        if category_id is not None:
            query = query.where(Product.category_id == category_id)
        # Fiyat aralığı kaydırıcısının sınırları, fiyat filtresi uygulanmadan hesaplanır.
        visible = query.subquery()
        bounds = self.db.execute(select(func.min(visible.c.sale_price), func.max(visible.c.sale_price))).one()
        if min_price is not None:
            query = query.where(Product.sale_price >= min_price)
        if max_price is not None:
            query = query.where(Product.sale_price <= max_price)
        if in_stock:
            query = query.where(Product.stock > 0)
        total = self.db.scalar(select(func.count()).select_from(query.subquery()))
        products = self.db.scalars(
            query.options(joinedload(Product.category))
            .order_by(*SORTS[sort], Product.id)
            .offset(page.offset)
            .limit(page.page_size)
        ).all()
        return CatalogPage(
            items=[catalog_product(p) for p in products],
            total=total,
            page=page.page,
            page_size=page.page_size,
            min_price=bounds[0],
            max_price=bounds[1],
        )

    def product(self, product_id: int) -> CatalogProductDetail:
        product = self.db.scalar(self._visible().options(joinedload(Product.category)).where(Product.id == product_id))
        if product is None:
            raise NotFoundError("Bu ürün artık satışta değil.", code="PRODUCT_UNAVAILABLE")
        related = self.db.scalars(
            self._visible()
            .options(joinedload(Product.category))
            .where(Product.category_id == product.category_id, Product.id != product.id, Product.stock > 0)
            .order_by(Product.name)
            .limit(4)
        ).all()
        return CatalogProductDetail(
            **catalog_product(product).model_dump(), related=[catalog_product(p) for p in related]
        )

    def validate(self, lines: Sequence[CartLine]) -> tuple[dict[int, Product], CartValidation]:
        """Sepeti sunucudaki güncel bilgilerle karşılaştırır (UC-07 4a): satış dışı ürün, fiyat değişikliği, stok."""
        ids = [line.product_id for line in lines]
        products = {
            p.id: p
            for p in self.db.scalars(self._visible().options(joinedload(Product.category)).where(Product.id.in_(ids)))
        }
        issues: list[CartIssue] = []
        for line in lines:
            product = products.get(line.product_id)
            if product is None:
                issues.append(
                    CartIssue(
                        product_id=line.product_id,
                        issue=CartIssueType.NOT_AVAILABLE,
                        message="Bu ürün artık satışta değil, lütfen sepetten çıkarın.",
                    )
                )
            elif product.sale_price != line.expected_price:
                issues.append(
                    CartIssue(
                        product_id=product.id,
                        issue=CartIssueType.PRICE_CHANGED,
                        message=f"Fiyat {line.expected_price} ₺ → {product.sale_price} ₺ olarak güncellendi.",
                        old_price=line.expected_price,
                        new_price=product.sale_price,
                    )
                )
            elif line.quantity > product.stock:
                issues.append(
                    CartIssue(
                        product_id=product.id,
                        issue=CartIssueType.INSUFFICIENT_STOCK,
                        message=(
                            f"Stokta yalnızca {product.stock} adet var."
                            if product.stock > 0
                            else "Bu ürün şu anda stokta yok."
                        ),
                        available_qty=max(product.stock, 0),
                    )
                )
        return products, CartValidation(products=[catalog_product(p) for p in products.values()], issues=issues)


class MyOrderService:
    """Müşterinin kendi siparişleri (E-32 – E-35, FR-16). Başkasının siparişi 404 döner."""

    def __init__(self, db: Session, user: User):
        self.db = db
        self.user = user

    def _customer(self, *, for_ordering: bool = False) -> Customer:
        customer = self.user.customer
        if customer is None:
            raise ForbiddenError("Müşteri kaydınız bulunamadı.", code="NO_CUSTOMER_PROFILE")
        if for_ordering and not customer.is_active:
            raise ForbiddenError("Müşteri kaydınız pasif; sipariş veremezsiniz.", code="CUSTOMER_INACTIVE")
        return customer

    def create(self, data: ShopOrderRequest) -> MyOrderDetail:
        customer = self._customer(for_ordering=True)
        products, validation = CatalogService(self.db).validate(data.items)
        if validation.issues:
            raise ConflictError(
                "Sepetinizdeki bazı ürünler değişti. Lütfen sepeti kontrol edin.",
                code="CART_CHANGED",
                details=[issue.model_dump(mode="json") for issue in validation.issues],
            )

        order = Order(
            order_code=OrderRepository(self.db).next_code(clock.now().year),
            customer=customer,
            status=OrderStatus.PENDING,
            payment_method=data.payment_method,
            shipping_address=data.shipping_address,
            note=data.note or None,
            created_by_id=None,  # müşterinin kendisi oluşturdu
            total_amount=Decimal("0"),
        )
        for line in data.items:
            product = products[line.product_id]
            line_total = product.sale_price * line.quantity
            order.items.append(
                OrderItem(product=product, quantity=line.quantity, unit_price=product.sale_price, line_total=line_total)
            )
            order.total_amount += line_total
        order.history.append(
            OrderStatusHistory(from_status=None, to_status=OrderStatus.PENDING, changed_by_id=self.user.id)
        )
        self.db.add(order)
        self.db.commit()
        return self.detail(order.id)

    def _query(self) -> Select:
        return (
            select(Order)
            .options(selectinload(Order.items).joinedload(OrderItem.product), selectinload(Order.history))
            .where(Order.customer_id == self._customer().id)
        )

    def _summary(self, order: Order) -> dict:
        return {
            "id": order.id,
            "order_code": order.order_code,
            "created_at": order.created_at,
            "status": order.status,
            "total_amount": order.total_amount,
            "item_count": len(order.items),
            "preview": [_item(i) for i in order.items[:PREVIEW_ITEMS]],
            "can_cancel": order.status == OrderStatus.PENDING,
        }

    def list(
        self, page: PageParams, *, group: StatusGroup | None, search: str | None, date_from, date_to
    ) -> tuple[list[MyOrderSummary], int]:
        query = self._query()
        if group is not None:
            query = query.where(Order.status.in_(STATUS_GROUPS[group]))
        if search:
            query = query.where(Order.order_code.ilike(f"%{search}%"))
        if date_from is not None:
            query = query.where(Order.created_at >= date_from)
        if date_to is not None:
            query = query.where(Order.created_at <= date_to)
        total = self.db.scalar(select(func.count()).select_from(query.with_only_columns(Order.id).subquery()))
        orders = self.db.scalars(
            query.order_by(Order.created_at.desc(), Order.id.desc()).offset(page.offset).limit(page.page_size)
        ).all()
        return [MyOrderSummary(**self._summary(o)) for o in orders], total

    def _get(self, order_id: int) -> Order:
        order = self.db.scalar(self._query().where(Order.id == order_id))
        if order is None:
            raise NotFoundError("Sipariş bulunamadı.")
        return order

    def detail(self, order_id: int) -> MyOrderDetail:
        order = self._get(order_id)
        return MyOrderDetail(
            **self._summary(order),
            items=[_item(i) for i in order.items],
            payment_method=order.payment_method,
            shipping_address=order.shipping_address,
            note=order.note,
            timeline=[MyStatusStep(status=h.to_status, at=h.changed_at) for h in order.history],
        )

    def cancel(self, order_id: int) -> MyOrderDetail:
        """Müşteri yalnızca onay bekleyen siparişini iptal edebilir; stok henüz düşülmediği için iade yoktur."""
        order = self.db.scalar(
            select(Order)
            .where(Order.id == order_id, Order.customer_id == self._customer().id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if order is None:
            raise NotFoundError("Sipariş bulunamadı.")
        if order.status != OrderStatus.PENDING:
            raise ConflictError("Siparişiniz onaylandığı için artık iptal edilemiyor.", code="CANNOT_CANCEL")
        order.status = OrderStatus.CANCELLED
        order.cancelled_at = datetime.now(UTC)
        order.history.append(
            OrderStatusHistory(
                from_status=OrderStatus.PENDING, to_status=OrderStatus.CANCELLED, changed_by_id=self.user.id
            )
        )
        self.db.commit()
        self.db.expire_all()
        return self.detail(order.id)
