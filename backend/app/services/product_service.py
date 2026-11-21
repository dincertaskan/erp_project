from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.errors import AppError, ConflictError, NotFoundError
from app.models import Category, Product, StockMovement, StockMovementType, User, UserRole
from app.repositories.catalog_repository import CategoryRepository, ProductRepository
from app.schemas.catalog import (
    MovementOut,
    ProductAdminDetailOut,
    ProductAdminOut,
    ProductCreateRequest,
    ProductDetailOut,
    ProductOut,
    ProductSort,
    ProductStats,
    ProductUpdateRequest,
    StockStatus,
    stock_status,
)
from app.schemas.common import Page, PageParams
from app.services.sku import next_sku, sku_prefix

SKU_TAKEN = "Bu SKU kullanılıyor."


def _fields(product: Product) -> dict:
    return {
        "id": product.id,
        "sku": product.sku,
        "name": product.name,
        "description": product.description,
        "category": product.category,
        "sale_price": product.sale_price,
        "cost_price": product.cost_price,
        "stock": product.stock,
        "min_stock": product.min_stock,
        "stock_status": stock_status(product.stock, product.min_stock),
        "image_url": product.image_url,
        "is_active": product.is_active,
        "created_at": product.created_at,
        "updated_at": product.updated_at,
    }


def product_out(product: Product, viewer: User) -> ProductOut:
    """Maliyet yalnızca yöneticiye gösterilir (karar 9)."""
    model = ProductAdminOut if viewer.role == UserRole.ADMIN else ProductOut
    return model.model_validate(_fields(product))


class ProductService:
    """Ürün kataloğu yönetimi (FR-06, FR-07). Ürünler silinmez, pasife alınır."""

    def __init__(self, db: Session):
        self.db = db
        self.products = ProductRepository(db)
        self.categories = CategoryRepository(db)

    def list(
        self,
        viewer: User,
        page: PageParams,
        *,
        search: str | None,
        category_ids: Sequence[int],
        stock_status: StockStatus | None,
        is_active: bool | None,
        sort: ProductSort,
        descending: bool,
    ) -> Page[ProductOut]:
        if sort == ProductSort.COST_PRICE and viewer.role != UserRole.ADMIN:
            raise AppError("Bu alana göre sıralama yapılamaz.", code="INVALID_SORT")
        products, total = self.products.list(
            search=search,
            category_ids=category_ids,
            stock_status=stock_status,
            is_active=is_active,
            sort=sort,
            descending=descending,
            offset=page.offset,
            limit=page.page_size,
        )
        # Sayfa türü de role göre seçilir; aksi halde maliyet alanı serileştirmede düşer.
        page_model = Page[ProductAdminOut] if viewer.role == UserRole.ADMIN else Page[ProductOut]
        return page_model(
            items=[product_out(p, viewer) for p in products], total=total, page=page.page, page_size=page.page_size
        )

    def _get(self, product_id: int) -> Product:
        product = self.products.get(product_id)
        if product is None:
            raise NotFoundError("Ürün bulunamadı.")
        return product

    def detail(self, viewer: User, product_id: int) -> ProductDetailOut:
        product = self._get(product_id)
        stats = ProductStats(
            sold_last_30_days=self.products.sold_since(product.id, datetime.now(UTC) - timedelta(days=30)),
            last_movement_at=self.products.last_movement_at(product.id),
        )
        model = ProductAdminDetailOut if viewer.role == UserRole.ADMIN else ProductDetailOut
        return model.model_validate({**_fields(product), "stats": stats})

    def _category_for(self, category_id: int, current: Product | None = None) -> Category:
        category = self.categories.get(category_id)
        if category is None:
            raise AppError(
                "Kategori bulunamadı.",
                code="CATEGORY_NOT_FOUND",
                details=[{"field": "category_id", "message": "Kategori bulunamadı."}],
            )
        # Mevcut kategorisi sonradan pasife alınmış bir ürün düzenlenebilir; yeni atama yalnızca aktif kategoriye.
        if not category.is_active and (current is None or current.category_id != category.id):
            raise AppError(
                "Pasif bir kategoriye ürün eklenemez.",
                code="CATEGORY_INACTIVE",
                details=[{"field": "category_id", "message": "Pasif bir kategoriye ürün eklenemez."}],
            )
        return category

    def _ensure_sku_free(self, sku: str, current_id: int | None = None) -> None:
        existing = self.products.get_by_sku(sku)
        if existing is not None and existing.id != current_id:
            raise ConflictError(SKU_TAKEN, code="SKU_TAKEN", details=[{"field": "sku", "message": SKU_TAKEN}])

    def suggest_sku(self, category_id: int) -> str:
        category = self._category_for(category_id)
        prefix = sku_prefix(category.name)
        return next_sku(prefix, self.products.skus_with_prefix(prefix))

    def create(self, actor: User, data: ProductCreateRequest) -> ProductOut:
        category = self._category_for(data.category_id)
        sku = data.sku or self.suggest_sku(category.id)
        self._ensure_sku_free(sku)

        product = Product(
            sku=sku,
            name=data.name,
            description=data.description,
            category=category,
            sale_price=data.sale_price,
            cost_price=data.cost_price,
            stock=data.initial_stock,
            min_stock=data.min_stock,
            image_url=data.image_url,
            is_active=data.is_active,
        )
        self.db.add(product)
        self.db.flush()
        # Başlangıç stoku da bir giriş hareketi olarak kaydedilir; stok geçmişi sıfırdan başlar.
        if data.initial_stock > 0:
            self.db.add(
                StockMovement(
                    product_id=product.id,
                    user_id=actor.id,
                    movement_type=StockMovementType.IN,
                    quantity=data.initial_stock,
                    previous_stock=0,
                    new_stock=data.initial_stock,
                    description="Başlangıç stoku",
                )
            )
        self.db.commit()
        self.db.refresh(product)
        return product_out(product, actor)

    def update(self, actor: User, product_id: int, data: ProductUpdateRequest) -> ProductOut:
        product = self._get(product_id)
        category = self._category_for(data.category_id, product)
        self._ensure_sku_free(data.sku, product.id)

        # Stok miktarı burada değişmez; yalnızca stok işlemleriyle değişir.
        product.sku = data.sku
        product.name = data.name
        product.description = data.description
        product.category = category
        product.sale_price = data.sale_price
        product.cost_price = data.cost_price
        product.min_stock = data.min_stock
        product.image_url = data.image_url
        product.is_active = data.is_active
        self.db.commit()
        self.db.refresh(product)
        return product_out(product, actor)

    def set_status(self, actor: User, product_id: int, is_active: bool) -> ProductOut:
        product = self._get(product_id)
        product.is_active = is_active
        self.db.commit()
        self.db.refresh(product)
        return product_out(product, actor)

    def movements(
        self,
        product_id: int,
        page: PageParams,
        *,
        movement_type: StockMovementType | None,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> Page[MovementOut]:
        self._get(product_id)
        items, total = self.products.movements(
            product_id,
            movement_type=movement_type,
            date_from=date_from,
            date_to=date_to,
            offset=page.offset,
            limit=page.page_size,
        )
        return Page[MovementOut](
            items=[MovementOut.model_validate(m) for m in items], total=total, page=page.page, page_size=page.page_size
        )
