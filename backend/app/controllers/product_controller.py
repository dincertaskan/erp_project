from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.routing import SessionReleasingRoute
from app.models import StockMovementType, User, UserRole
from app.schemas.catalog import (
    MovementOut,
    ProductAdminDetailOut,
    ProductAdminOut,
    ProductCreateRequest,
    ProductSort,
    ProductUpdateRequest,
    SkuSuggestion,
    StockStatus,
)
from app.schemas.common import Page, PageParams
from app.schemas.user import StatusUpdateRequest
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["Ürünler"], route_class=SessionReleasingRoute)

staff = require_roles(UserRole.ADMIN, UserRole.WAREHOUSE)
admin_only = require_roles(UserRole.ADMIN)

SORT_PATTERN = r"^-?(" + "|".join(s.value for s in ProductSort) + r")$"
# Yanıtlar role göre farklıdır (depo personeline maliyet gönderilmez); şema yönetici görünümünü belgeler.
STAFF_NOTE = "Depo personelinin yanıtında `cost_price` alanı yoktur."


@router.get(
    "",
    response_model=None,
    responses={200: {"model": Page[ProductAdminOut], "description": STAFF_NOTE}},
)
def list_products(
    page: PageParams = Depends(),
    search: str | None = Query(None, max_length=100),
    category_id: list[int] = Query(default=[]),
    stock_status: StockStatus | None = None,
    is_active: bool | None = None,
    sort: str = Query("name", pattern=SORT_PATTERN, description="Alan adı; azalan sıra için başına '-' eklenir"),
    viewer: User = Depends(staff),
    db: Session = Depends(get_db),
):
    return ProductService(db).list(
        viewer,
        page,
        search=search,
        category_ids=category_id,
        stock_status=stock_status,
        is_active=is_active,
        sort=ProductSort(sort.lstrip("-")),
        descending=sort.startswith("-"),
    )


@router.get("/next-sku", response_model=SkuSuggestion)
def suggest_sku(category_id: int, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    return SkuSuggestion(sku=ProductService(db).suggest_sku(category_id))


@router.get(
    "/{product_id}",
    response_model=None,
    responses={200: {"model": ProductAdminDetailOut, "description": STAFF_NOTE}},
)
def get_product(product_id: int, viewer: User = Depends(staff), db: Session = Depends(get_db)):
    return ProductService(db).detail(viewer, product_id)


@router.post("", response_model=ProductAdminOut, status_code=201)
def create_product(data: ProductCreateRequest, actor: User = Depends(admin_only), db: Session = Depends(get_db)):
    return ProductService(db).create(actor, data)


@router.put("/{product_id}", response_model=ProductAdminOut)
def update_product(
    product_id: int,
    data: ProductUpdateRequest,
    actor: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return ProductService(db).update(actor, product_id, data)


@router.patch("/{product_id}/status", response_model=ProductAdminOut)
def set_product_status(
    product_id: int,
    data: StatusUpdateRequest,
    actor: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return ProductService(db).set_status(actor, product_id, data.is_active)


@router.get("/{product_id}/movements", response_model=Page[MovementOut])
def product_movements(
    product_id: int,
    page: PageParams = Depends(),
    type: StockMovementType | None = None,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    _: User = Depends(staff),
    db: Session = Depends(get_db),
):
    return ProductService(db).movements(product_id, page, movement_type=type, date_from=date_from, date_to=date_to)
