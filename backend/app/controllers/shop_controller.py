from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.models import User, UserRole
from app.schemas.common import Page, PageParams
from app.schemas.shop import (
    CartValidateRequest,
    CartValidation,
    CatalogCategory,
    CatalogPage,
    CatalogProductDetail,
    CatalogSort,
    MyOrderDetail,
    MyOrderSummary,
    ShopOrderRequest,
    StatusGroup,
)
from app.services.shop_service import CatalogService, MyOrderService

customer_only = require_roles(UserRole.CUSTOMER)

catalog_router = APIRouter(prefix="/catalog", tags=["Mağaza"])
me_router = APIRouter(prefix="/me", tags=["Mağaza"])


@catalog_router.get("/categories", response_model=list[CatalogCategory])
def catalog_categories(_: User = Depends(customer_only), db: Session = Depends(get_db)):
    """Yalnızca aktif ve içinde satışta ürün olan kategoriler."""
    return CatalogService(db).categories()


@catalog_router.get("/products", response_model=CatalogPage)
def catalog_products(
    page: PageParams = Depends(),
    search: str | None = Query(None, max_length=100),
    category_id: int | None = None,
    min_price: Decimal | None = Query(None, ge=0),
    max_price: Decimal | None = Query(None, ge=0),
    in_stock: bool = False,
    sort: CatalogSort = CatalogSort.RECOMMENDED,
    _: User = Depends(customer_only),
    db: Session = Depends(get_db),
):
    """Aktif kategorilerdeki aktif ürünler; maliyet dönmez, stok müşteriye uygun biçimde verilir."""
    return CatalogService(db).products(
        page,
        search=search,
        category_id=category_id,
        min_price=min_price,
        max_price=max_price,
        in_stock=in_stock,
        sort=sort,
    )


@catalog_router.get("/products/{product_id}", response_model=CatalogProductDetail)
def catalog_product(product_id: int, _: User = Depends(customer_only), db: Session = Depends(get_db)):
    return CatalogService(db).product(product_id)


@me_router.post("/cart/validate", response_model=CartValidation)
def validate_cart(data: CartValidateRequest, _: User = Depends(customer_only), db: Session = Depends(get_db)):
    """Tarayıcıda tutulan sepeti güncel fiyat, satış durumu ve stokla karşılaştırır (karar 8)."""
    return CatalogService(db).validate(data.items)[1]


@me_router.post("/orders", response_model=MyOrderDetail, status_code=201)
def place_order(data: ShopOrderRequest, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    """Sepet sunucuda yeniden doğrulanır; değişiklik varsa 422 CART_CHANGED ve sorunlu kalemler döner."""
    return MyOrderService(db, user).create(data)


@me_router.get("/orders", response_model=Page[MyOrderSummary])
def my_orders(
    page: PageParams = Depends(),
    status_group: StatusGroup | None = None,
    search: str | None = Query(None, max_length=40),
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    user: User = Depends(customer_only),
    db: Session = Depends(get_db),
):
    items, total = MyOrderService(db, user).list(
        page, group=status_group, search=search, date_from=date_from, date_to=date_to
    )
    return Page[MyOrderSummary](items=items, total=total, page=page.page, page_size=page.page_size)


@me_router.get("/orders/{order_id}", response_model=MyOrderDetail)
def my_order(order_id: int, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    return MyOrderService(db, user).detail(order_id)


@me_router.post("/orders/{order_id}/cancel", response_model=MyOrderDetail)
def cancel_my_order(order_id: int, user: User = Depends(customer_only), db: Session = Depends(get_db)):
    """Yalnızca onay bekleyen sipariş iptal edilebilir; aksi halde 409."""
    return MyOrderService(db, user).cancel(order_id)
