from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.models import Category
from app.repositories.catalog_repository import CategoryRepository
from app.schemas.catalog import CategoryOut, CategoryRequest

NAME_TAKEN = "Bu isimde bir kategori zaten var."


class CategoryService:
    """Kategori ekleme, düzenleme ve pasife alma (FR-05). Kategoriler silinmez."""

    def __init__(self, db: Session):
        self.db = db
        self.categories = CategoryRepository(db)

    def list(self, *, search: str | None, is_active: bool | None) -> list[CategoryOut]:
        return [
            CategoryOut.model_validate(category).model_copy(update={"product_count": count})
            for category, count in self.categories.list_with_counts(search=search, is_active=is_active)
        ]

    def _get(self, category_id: int) -> Category:
        category = self.categories.get(category_id)
        if category is None:
            raise NotFoundError("Kategori bulunamadı.")
        return category

    def _ensure_unique(self, name: str, current_id: int | None = None) -> None:
        existing = self.categories.get_by_name(name)
        if existing is not None and existing.id != current_id:
            raise ConflictError(
                NAME_TAKEN, code="CATEGORY_NAME_TAKEN", details=[{"field": "name", "message": NAME_TAKEN}]
            )

    def _out(self, category: Category) -> CategoryOut:
        count = self.categories.active_product_count(category.id)
        return CategoryOut.model_validate(category).model_copy(update={"product_count": count})

    def create(self, data: CategoryRequest) -> CategoryOut:
        self._ensure_unique(data.name)
        category = Category(name=data.name, color=data.color, is_active=data.is_active)
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return self._out(category)

    def update(self, category_id: int, data: CategoryRequest) -> CategoryOut:
        category = self._get(category_id)
        self._ensure_unique(data.name, category.id)
        category.name = data.name
        category.color = data.color
        category.is_active = data.is_active
        self.db.commit()
        self.db.refresh(category)
        return self._out(category)

    def set_status(self, category_id: int, is_active: bool) -> CategoryOut:
        category = self._get(category_id)
        category.is_active = is_active
        self.db.commit()
        self.db.refresh(category)
        return self._out(category)
