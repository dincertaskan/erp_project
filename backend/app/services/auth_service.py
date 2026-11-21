from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.errors import AppError, ConflictError, ForbiddenError, TooManyRequestsError, UnauthorizedError
from app.core.login_throttle import login_throttle
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Customer, User, UserRole
from app.repositories.user_repository import UserRepository
from app.schemas.user import LoginRequest, PasswordChangeRequest, ProfileUpdateRequest, RegisterRequest

CUSTOMER_ONLY_FIELDS = ("phone", "company_name", "address", "city")


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.users = UserRepository(db)

    def register(self, data: RegisterRequest) -> User:
        """Yeni kayıtlar her zaman müşteri rolüyle oluşturulur (FR-01)."""
        if self.users.get_by_email(data.email):
            raise ConflictError(
                "Bu e-posta adresi zaten kayıtlı.",
                code="EMAIL_TAKEN",
                details=[{"field": "email", "message": "Bu e-posta adresi zaten kayıtlı."}],
            )
        user = User(
            full_name=data.full_name,
            email=data.email,
            password_hash=hash_password(data.password),
            role=UserRole.CUSTOMER,
        )
        self.db.add(user)
        self.db.flush()

        # Yöneticinin daha önce aynı e-postayla eklediği bir müşteri kartı varsa hesaba bağlanır.
        customer = self.users.get_customer_by_email(data.email)
        if customer is None:
            customer = Customer(full_name=data.full_name, email=data.email, phone=data.phone)
            self.db.add(customer)
        elif data.phone and not customer.phone:
            customer.phone = data.phone
        customer.user_id = user.id

        self.db.commit()
        self.db.refresh(user)
        return user

    def login(self, data: LoginRequest) -> tuple[str, User]:
        retry_after = login_throttle.retry_after(data.email)
        if retry_after:
            minutes = max(1, retry_after // 60)
            raise TooManyRequestsError(
                f"Çok fazla hatalı deneme yapıldı. {minutes} dakika sonra tekrar deneyin.",
                details={"retry_after": retry_after},
            )

        user = self.users.get_by_email(data.email)
        if user is None or not verify_password(data.password, user.password_hash):
            login_throttle.record_failure(data.email)
            raise UnauthorizedError("E-posta veya şifre hatalı.", code="INVALID_CREDENTIALS")
        if not user.is_active:
            raise ForbiddenError("Hesabınız pasif durumda. Yöneticiyle iletişime geçin.", code="ACCOUNT_INACTIVE")

        login_throttle.reset(data.email)
        user.last_login_at = datetime.now(UTC)
        self.db.commit()
        return create_access_token(user.id, user.role.value), user

    def update_profile(self, user: User, data: ProfileUpdateRequest) -> User:
        changes = data.model_dump(exclude_unset=True)
        customer_changes = {key: changes.pop(key) for key in CUSTOMER_ONLY_FIELDS if key in changes}
        if customer_changes and user.customer is None:
            raise AppError("Bu alanlar yalnızca müşteri hesaplarında kullanılabilir.", code="NOT_A_CUSTOMER")

        if "full_name" in changes:
            user.full_name = changes["full_name"]
            if user.customer is not None:
                user.customer.full_name = changes["full_name"]
        for key, value in customer_changes.items():
            setattr(user.customer, key, value)

        self.db.commit()
        self.db.refresh(user)
        return user

    def change_password(self, user: User, data: PasswordChangeRequest) -> None:
        if not verify_password(data.current_password, user.password_hash):
            raise AppError(
                "Mevcut şifre hatalı.",
                code="INVALID_PASSWORD",
                details=[{"field": "current_password", "message": "Mevcut şifre hatalı."}],
            )
        user.password_hash = hash_password(data.new_password)
        self.db.commit()
