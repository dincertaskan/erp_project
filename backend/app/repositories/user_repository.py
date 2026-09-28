from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user_schema import UserCreate

class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email).first()

    def create_user(self, user: UserCreate, hashed_password: str) -> User:
        # Rol doğrulaması ('admin' veya 'customer')
        allowed_roles = ["admin", "customer"]
        selected_role = user.role if user.role in allowed_roles else "admin"

        db_user = User(
            full_name=user.full_name,
            email=user.email,
            password_hash=hashed_password,
            role=selected_role,  # Seçilen rol atanıyor
            is_active=True
        )
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user