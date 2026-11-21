"""Stok miktarını değiştiren tüm işlemlerin geçtiği tek yer (elle giriş/çıkış, sipariş onayı, iptal iadesi).

Ürün satırları SELECT ... FOR UPDATE ile kilitlenir; aynı ürüne gelen eşzamanlı işlemler sırayla çalışır ve
stok hiçbir zaman eksiye düşmez. Kilitler kimlik sırasıyla alınır, böylece çok ürünlü işlemler kilitlenmez.
"""

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import ConflictError, NotFoundError
from app.models import Product, StockMovement, StockMovementType

DECREASING = {StockMovementType.OUT, StockMovementType.ORDER_OUT}


class InsufficientStockError(ConflictError):
    code = "INSUFFICIENT_STOCK"

    def __init__(self, shortages: list[dict]):
        if len(shortages) == 1:
            message = f"Yetersiz stok. Mevcut: {shortages[0]['available']}."
        else:
            message = f"{len(shortages)} üründe stok yetersiz."
        super().__init__(message, details=shortages)


def shortage(product: Product, requested: int) -> dict:
    return {
        "product_id": product.id,
        "sku": product.sku,
        "name": product.name,
        "requested": requested,
        "available": product.stock,
    }


def lock_products(db: Session, product_ids: Iterable[int]) -> dict[int, Product]:
    ids = sorted(set(product_ids))
    products = db.scalars(
        select(Product)
        .options(joinedload(Product.category))
        .where(Product.id.in_(ids))
        .order_by(Product.id)
        .with_for_update(of=Product)
    ).all()
    found = {p.id: p for p in products}
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
    """Kilitli ürünün stoğunu değiştirir ve hareketi kaydeder. Commit çağıranın işidir."""
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
    product.stock = new_stock
    # İyimser kilit stratejisi (Deney 1) bu sürüm numarasını karşılaştırır.
    product.version += 1
    db.add(movement)
    return movement
