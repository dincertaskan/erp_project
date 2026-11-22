"""Stok miktarını değiştiren tüm işlemlerin geçtiği tek yer (elle giriş/çıkış, sipariş onayı, iptal iadesi).

Stratejiler (Deney 1, ayar: STOCK_STRATEGY):
- pessimistic: ürün satırları SELECT ... FOR UPDATE ile kilitlenir; eşzamanlı işlemler sırayla çalışır.
- optimistic: kilit alınmaz; UPDATE "WHERE version = ?" ile yapılır (Product.version_id_col). Araya başka bir
  yazma girdiyse commit sırasında StockConflictError oluşur ve işlem yeniden denenebilir.
- none: yalnızca deneyde referans; kilit ve sürüm kontrolü olmadan oku-kontrol et-yaz. Eşzamanlı işlemler
  birbirinin yazdığını ezebilir (fazla satış). Üretimde kullanılmaz.

pessimistic ve optimistic stratejilerinde stok hiçbir zaman eksiye düşmez. Kilitler kimlik sırasıyla
alınır, böylece çok ürünlü işlemler birbirini kilitlemez.
"""

from collections.abc import Callable, Iterable

from sqlalchemy import select, update
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm.attributes import set_committed_value
from sqlalchemy.orm.exc import StaleDataError

from app.core.config import settings
from app.core.errors import ConflictError, NotFoundError
from app.models import Product, StockMovement, StockMovementType

DECREASING = {StockMovementType.OUT, StockMovementType.ORDER_OUT}
OPTIMISTIC_ATTEMPTS = 3


class InsufficientStockError(ConflictError):
    code = "INSUFFICIENT_STOCK"

    def __init__(self, shortages: list[dict]):
        if len(shortages) == 1:
            message = f"Yetersiz stok. Mevcut: {shortages[0]['available']}."
        else:
            message = f"{len(shortages)} üründe stok yetersiz."
        super().__init__(message, details=shortages)


class StockConflictError(ConflictError):
    code = "STOCK_CONFLICT"

    def __init__(self):
        super().__init__("Stok başka bir işlemle değişti. Lütfen tekrar deneyin.")


def shortage(product: Product, requested: int) -> dict:
    return {
        "product_id": product.id,
        "sku": product.sku,
        "name": product.name,
        "requested": requested,
        "available": product.stock,
    }


def lock_products(db: Session, product_ids: Iterable[int]) -> dict[int, Product]:
    """Ürünleri stratejiye göre yükler: kötümser modda satırlar kilitlenir, iyimser modda güncel hali okunur."""
    ids = sorted(set(product_ids))
    query = select(Product).options(joinedload(Product.category)).where(Product.id.in_(ids)).order_by(Product.id)
    if settings.STOCK_STRATEGY == "pessimistic":
        query = query.with_for_update(of=Product)
    else:
        query = query.execution_options(populate_existing=True)
    found = {p.id: p for p in db.scalars(query).all()}
    missing = [i for i in ids if i not in found]
    if missing:
        raise NotFoundError("Ürün bulunamadı.", details={"product_ids": missing})
    return found


def apply_movement(
    db: Session,
    product: Product,
    *,
    movement_type: StockMovementType,
    quantity: int,
    user_id: int,
    order_id: int | None = None,
    description: str | None = None,
) -> StockMovement:
    """Ürünün stoğunu değiştirir ve hareketi kaydeder. Commit çağıranın işidir (commit_stock_changes)."""
    delta = -quantity if movement_type in DECREASING else quantity
    new_stock = product.stock + delta
    if new_stock < 0:
        raise InsufficientStockError([shortage(product, quantity)])

    movement = StockMovement(
        product_id=product.id,
        user_id=user_id,
        order_id=order_id,
        movement_type=movement_type,
        quantity=quantity,
        previous_stock=product.stock,
        new_stock=new_stock,
        description=description,
    )
    if settings.STOCK_STRATEGY == "none":
        # Deney 1 referansı: okunan değer üzerine sürüm kontrolsüz yazılır (kayıp güncelleme mümkündür).
        db.execute(update(Product).where(Product.id == product.id).values(stock=new_stock))
        set_committed_value(product, "stock", new_stock)
    else:
        product.stock = new_stock
    db.add(movement)
    return movement


def commit_stock_changes(db: Session) -> None:
    """İyimser modda araya giren bir yazma StockConflictError'a dönüşür."""
    try:
        db.commit()
    except StaleDataError as exc:
        db.rollback()
        raise StockConflictError() from exc


def with_retry[T](db: Session, operation: Callable[[], T]) -> T:
    """İyimser modda çakışan işlemi birkaç kez yeniden dener; kötümser modda tek sefer çalışır."""
    attempts = OPTIMISTIC_ATTEMPTS if settings.STOCK_STRATEGY == "optimistic" else 1
    for attempt in range(1, attempts + 1):
        try:
            return operation()
        except StockConflictError:
            if attempt == attempts:
                raise
            db.expire_all()
    raise AssertionError("unreachable")
