from sqlalchemy.orm import Session

from app.core.errors import AppError, ConflictError, NotFoundError
from app.models import Customer, User, UserRole
from app.repositories.user_repository import UserRepository
from app.schemas.common import Page, PageParams
from app.schemas.user import UserOut


class UserService:
    """Yöneticinin kullanıcıları listelemesi, rol ataması ve hesapları pasife alması (FR-04)."""

    def __init__(self, db: Session):
        self.db = db
        self.users = UserRepository(db)

    def list(
        self, page: PageParams, *, search: str | None, role: UserRole | None, is_active: bool | None
    ) -> Page[UserOut]:
        users, total = self.users.list(
            search=search, role=role, is_active=is_active, offset=page.offset, limit=page.page_size
        )
        return Page[UserOut](
            items=[UserOut.model_validate(u) for u in users], total=total, page=page.page, page_size=page.page_size
        )

    def _get(self, user_id: int) -> User:
        user = self.users.get(user_id)
        if user is None:
            raise NotFoundError("Kullanıcı bulunamadı.")
        return user

    def _ensure_not_last_admin(self, user: User) -> None:
        if user.role != UserRole.ADMIN or not user.is_active:
            return
        admin_ids = self.users.lock_active_admin_ids()
        if user.id in admin_ids and len(admin_ids) <= 1:
            raise ConflictError("Sistemdeki son aktif yönetici değiştirilemez.", code="LAST_ADMIN")

    def set_role(self, actor: User, user_id: int, role: UserRole) -> User:
        user = self._get(user_id)
        if user.id == actor.id:
            raise AppError("Kendi rolünüzü değiştiremezsiniz.", code="SELF_CHANGE")
        if user.role == role:
            return user
        if role != UserRole.ADMIN:
            self._ensure_not_last_admin(user)

        user.role = role
        if role == UserRole.CUSTOMER and user.customer is None:
            customer = self.users.get_customer_by_email(user.email)
            if customer is None:
                customer = Customer(full_name=user.full_name, email=user.email)
                self.db.add(customer)
            customer.user = user
        self.db.commit()
        self.db.refresh(user)
        return user

    def set_status(self, actor: User, user_id: int, is_active: bool) -> User:
        user = self._get(user_id)
        if user.id == actor.id:
            raise AppError("Kendi hesabınızı pasife alamazsınız.", code="SELF_CHANGE")
        if not is_active:
            self._ensure_not_last_admin(user)
        user.is_active = is_active
        self.db.commit()
        self.db.refresh(user)
        return user
