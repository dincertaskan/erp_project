from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import AppError
from app.models import StockMovementType, User
from app.repositories.stock_repository import StockRepository
from app.schemas.catalog import MovementOut, stock_status
from app.schemas.common import Page, PageParams
from app.schemas.stock import (
    CriticalProductOut,
    ManualMovementType,
    MovementFilters,
    MovementListItem,
    ProductStock,
    StockMovementRequest,
    StockMovementResult,
    StockSummary,
)
from app.services.product_service import product_fields
from app.services.stock_ledger import apply_movement, commit_stock_changes, lock_products, with_retry

MANUAL_TYPES = {ManualMovementType.IN: StockMovementType.IN, ManualMovementType.OUT: StockMovementType.OUT}


class StockService:
    """Elle stok girişi/çıkışı (FR-08), hareket geçmişi (FR-09) ve kritik stok (FR-10)."""

    def __init__(self, db: Session):
        self.db = db
        self.stock = StockRepository(db)

    def record(self, actor: User, data: StockMovementRequest) -> StockMovementResult:
        return with_retry(self.db, lambda: self._record(actor, data))

    def _record(self, actor: User, data: StockMovementRequest) -> StockMovementResult:
        product = lock_products(self.db, [data.product_id])[data.product_id]
        # Hata olursa commit edilmez; oturum kapanınca işlem geri alınır ve kilit bırakılır.
        if not product.is_active:
            raise AppError("Pasif ürüne stok işlemi yapılamaz.", code="PRODUCT_INACTIVE")
        movement = apply_movement(
            self.db,
            product,
            movement_type=MANUAL_TYPES[data.movement_type],
            quantity=data.quantity,
            user_id=actor.id,
            description=data.description,
        )
        commit_stock_changes(self.db)
        self.db.refresh(movement)
        return StockMovementResult(
            movement=MovementOut.model_validate(movement),
            product=ProductStock(
                id=product.id, stock=product.stock, stock_status=stock_status(product.stock, product.min_stock)
            ),
        )

    def movements(self, filters: MovementFilters, page: PageParams) -> Page[MovementListItem]:
        items, total = self.stock.movements(filters, offset=page.offset, limit=page.page_size)
        return Page[MovementListItem](
            items=[MovementListItem.model_validate(m) for m in items],
            total=total,
            page=page.page,
            page_size=page.page_size,
        )

    def critical(self, page: PageParams, *, category_ids: Sequence[int]) -> Page[CriticalProductOut]:
        products, total = self.stock.critical(category_ids=category_ids, offset=page.offset, limit=page.page_size)
        ids = [p.id for p in products]
        sold = self.stock.sold_since(ids, datetime.now(UTC) - timedelta(days=30))
        last = self.stock.last_movement_at(ids)
        items = [
            CriticalProductOut.model_validate(
                {
                    **product_fields(p),
                    "last_movement_at": last.get(p.id),
                    "shortage": p.min_stock - p.stock,
                    "sold_last_30_days": sold.get(p.id, 0),
                }
            )
            for p in products
        ]
        return Page[CriticalProductOut](items=items, total=total, page=page.page, page_size=page.page_size)

    def critical_count(self) -> int:
        return self.stock.critical_count()

    def summary(self) -> StockSummary:
        # "Bugün" iş yerinin saatine göre hesaplanır.
        start_of_day = clock.start_of_day(clock.now())
        return StockSummary(
            active_products=self.stock.active_product_count(),
            critical_count=self.stock.critical_count(),
            today_movements=self.stock.movement_count_since(start_of_day),
        )
