from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Customer, User, UserRole


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(func.lower(User.email) == email.lower()))

    def get_customer_by_email(self, email: str) -> Customer | None:
        return self.db.scalar(select(Customer).where(func.lower(Customer.email) == email.lower()))

    def list(
        self,
        *,
        search: str | None,
        role: UserRole | None,
        is_active: bool | None,
        offset: int,
        limit: int,
    ) -> tuple[list[User], int]:
        query = select(User)
        if search:
            pattern = f"%{search}%"
            query = query.where(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
        if role is not None:
            query = query.where(User.role == role)
        if is_active is not None:
            query = query.where(User.is_active.is_(is_active))
        total = self.db.scalar(select(func.count()).select_from(query.subquery()))
        users = self.db.scalars(query.order_by(User.id).offset(offset).limit(limit)).all()
        return list(users), total

    def count_active_admins(self) -> int:
        return self.db.scalar(
            select(func.count()).select_from(User).where(User.role == UserRole.ADMIN, User.is_active.is_(True))
        )
