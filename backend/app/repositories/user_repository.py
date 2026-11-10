from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.erp import Customer
from app.schemas.user_schema import UserCreate


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email).first()

    def get_customer_by_email(self, email: str) -> Customer | None:
        return self.db.query(Customer).filter(func.lower(Customer.email) == email.lower()).first()

    def create_user(self, user: UserCreate, hashed_password: str) -> User:
        """Admin kullanıcıyı 'users' tablosuna kaydeder."""
        db_user = User(
            full_name=user.full_name,
            email=user.email,
            password_hash=hashed_password,
            role="admin",
            is_active=True
        )
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def create_customer(self, user: UserCreate, hashed_password: str) -> Customer:
        """Müşteriyi 'customers' tablosuna kaydeder."""
        db_customer = Customer(
            name=user.full_name,
            email=user.email,
            password_hash=hashed_password,
            is_active=True
        )
        self.db.add(db_customer)
        self.db.commit()
        self.db.refresh(db_customer)
        return db_customer
