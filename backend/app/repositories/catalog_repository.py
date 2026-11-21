from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models import Category, Product, StockMovement, StockMovementType
from app.schemas.catalog import ProductSort, StockStatus


class CategoryRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, category_id: int) -> Category | None:
        return self.db.get(Category, category_id)

    def get_by_name(self, name: str) -> Category | None:
        return self.db.scalar(select(Category).where(func.lower(Category.name) == name.lower()))

    def list_with_counts(self, *, search: str | None, is_active: bool | None) -> list[tuple[Category, int]]:
        active_products = (
            select(Product.category_id, func.count().label("product_count"))
            .where(Product.is_active.is_(True))
            .group_by(Product.category_id)
            .subquery()
        )
        query = select(Category, func.coalesce(active_products.c.product_count, 0)).outerjoin(
            active_products, active_products.c.category_id == Category.id
        )
        if search:
            query = query.where(Category.name.ilike(f"%{search}%"))
        if is_active is not None:
            query = query.where(Category.is_active.is_(is_active))
        return [(row[0], row[1]) for row in self.db.execute(query.order_by(Category.name)).all()]

    def active_product_count(self, category_id: int) -> int:
        return self.db.scalar(
            select(func.count()).where(Product.category_id == category_id, Product.is_active.is_(True))
        )


class ProductRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, product_id: int) -> Product | None:
        return self.db.scalar(select(Product).options(joinedload(Product.category)).where(Product.id == product_id))

    def get_by_sku(self, sku: str) -> Product | None:
        return self.db.scalar(select(Product).where(Product.sku == sku))

    def skus_with_prefix(self, prefix: str) -> list[str]:
        return list(self.db.scalars(select(Product.sku).where(Product.sku.like(f"{prefix}-%"))).all())

    def list(
        self,
        *,
        search: str | None,
        category_ids: Sequence[int],
        stock_status: StockStatus | None,
        is_active: bool | None,
        sort: ProductSort,
        descending: bool,
        offset: int,
        limit: int,
    ) -> tuple[list[Product], int]:
        query: Select = select(Product)
        if search:
            pattern = f"%{search}%"
            query = query.where(or_(Product.name.ilike(pattern), Product.sku.ilike(pattern)))
        if category_ids:
            query = query.where(Product.category_id.in_(category_ids))
        if is_active is not None:
            query = query.where(Product.is_active.is_(is_active))
        if stock_status == StockStatus.OUT_OF_STOCK:
            query = query.where(Product.stock <= 0)
        elif stock_status == StockStatus.CRITICAL:
            query = query.where(Product.stock > 0, Product.stock < Product.min_stock)
        elif stock_status == StockStatus.SUFFICIENT:
            query = query.where(Product.stock > 0, Product.stock >= Product.min_stock)

        total = self.db.scalar(select(func.count()).select_from(query.subquery()))
        column = getattr(Product, sort.value)
        order = column.desc() if descending else column.asc()
        products = self.db.scalars(
            query.options(joinedload(Product.category)).order_by(order, Product.id).offset(offset).limit(limit)
        ).all()
        return list(products), total

    def sold_since(self, product_id: int, since: datetime) -> int:
        return self.db.scalar(
            select(func.coalesce(func.sum(StockMovement.quantity), 0)).where(
                StockMovement.product_id == product_id,
                StockMovement.movement_type == StockMovementType.ORDER_OUT,
                StockMovement.created_at >= since,
            )
        )

    def last_movement_at(self, product_id: int) -> datetime | None:
        return self.db.scalar(select(func.max(StockMovement.created_at)).where(StockMovement.product_id == product_id))

    def movements(
        self,
        product_id: int,
        *,
        movement_type: StockMovementType | None,
        date_from: datetime | None,
        date_to: datetime | None,
        offset: int,
        limit: int,
    ) -> tuple[list[StockMovement], int]:
        query = select(StockMovement).where(StockMovement.product_id == product_id)
        if movement_type is not None:
            query = query.where(StockMovement.movement_type == movement_type)
        if date_from is not None:
            query = query.where(StockMovement.created_at >= date_from)
        if date_to is not None:
            query = query.where(StockMovement.created_at <= date_to)
        total = self.db.scalar(select(func.count()).select_from(query.subquery()))
        items = self.db.scalars(
            query.options(joinedload(StockMovement.user), joinedload(StockMovement.order))
            .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
            .offset(offset)
            .limit(limit)
        ).all()
        return list(items), total
