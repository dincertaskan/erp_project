import math
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core import invite_codes
from app.core.errors import AppError, ConflictError, ForbiddenError, TooManyRequestsError, UnauthorizedError
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Customer, RecordSource, User, UserRole
from app.repositories.user_repository import UserRepository
from app.schemas.user import LoginRequest, PasswordChangeRequest, ProfileUpdateRequest, RegisterRequest
from app.services.login_throttle import LoginThrottle

CUSTOMER_ONLY_FIELDS = ("phone", "company_name", "address", "city")
INVITE_REQUIRED = (
    "Bu e-posta adresine ait bir müşteri kaydı var. Hesabınızı bağlamak için mağazadan aldığınız davet kodunu girin."
)
INVITE_INVALID = "Davet kodu geçersiz ya da süresi dolmuş. Mağazadan yeni bir kod isteyin."


def _invite_error(message: str, code: str) -> AppError:
    return AppError(message, code=code, details=[{"field": "invite_code", "message": message}])


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.users = UserRepository(db)

    def register(self, data: RegisterRequest) -> User:
        """Yeni kayıtlar her zaman müşteri rolüyle oluşturulur (FR-01)."""
        # bcrypt veritabanı işlemi açılmadan çalışır; yavaş özetleme sırasında havuzdan bağlantı tutulmaz.
        password_hash = hash_password(data.password)
        customer = self.users.get_customer_by_email(data.email)
        # Olist kartlarının e-postaları tahmin edilebilir (olist-00001@example.com); bunlar hiçbir hesaba bağlanmaz.
        taken = customer is not None and (customer.source == RecordSource.OLIST or customer.user_id is not None)
        if self.users.get_by_email(data.email) or taken:
            raise ConflictError(
                "Bu e-posta adresi zaten kayıtlı.",
                code="EMAIL_TAKEN",
                details=[{"field": "email", "message": "Bu e-posta adresi zaten kayıtlı."}],
            )
        # Yöneticinin uygulamada açtığı kart, e-posta sahipliği kanıtlanmadan bağlanırsa kartın sipariş geçmişi,
        # adresi ve telefonu kayıt olan kişiye açılır. Kanıt olarak yöneticinin müşteriye ilettiği davet kodu istenir.
        if customer is not None and data.invite_code is None:
            raise _invite_error(INVITE_REQUIRED, "INVITE_CODE_REQUIRED")
        if data.invite_code is not None and (customer is None or not invite_codes.accepts(customer, data.invite_code)):
            raise _invite_error(INVITE_INVALID, "INVALID_INVITE_CODE")

        user = User(
            full_name=data.full_name,
            email=data.email,
            password_hash=password_hash,
            role=UserRole.CUSTOMER,
        )
        self.db.add(user)
        self.db.flush()

        if customer is None:
            customer = Customer(full_name=data.full_name, email=data.email, phone=data.phone)
            self.db.add(customer)
        else:
            invite_codes.revoke(customer)  # tek kullanımlık
            if data.phone and not customer.phone:
                customer.phone = data.phone
        customer.user_id = user.id

        self.db.commit()
        self.db.refresh(user)
        return user

    def login(self, data: LoginRequest, ip_address: str) -> tuple[str, User]:
        throttle = LoginThrottle(self.db)
        retry_after = throttle.retry_after(data.email, ip_address)
        if retry_after:
            minutes = math.ceil(retry_after / 60)
            raise TooManyRequestsError(
                f"Çok fazla hatalı deneme yapıldı. {minutes} dakika sonra tekrar deneyin.",
                details={"retry_after": retry_after},
            )

        user = self.users.get_by_email(data.email)
        # Okuma işlemi bcrypt'ten önce kapatılır; bağlantı doğrulama süresince havuza döner.
        self.db.commit()
        if user is None or not verify_password(data.password, user.password_hash):
            throttle.record_failure(data.email, ip_address)
            self.db.commit()
            raise UnauthorizedError("E-posta veya şifre hatalı.", code="INVALID_CREDENTIALS")
        if not user.is_active:
            raise ForbiddenError("Hesabınız pasif durumda. Yöneticiyle iletişime geçin.", code="ACCOUNT_INACTIVE")

        throttle.reset(data.email)
        user.last_login_at = datetime.now(UTC)
        self.db.commit()
        return create_access_token(user.id, user.role.value, user.token_version), user

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

    def change_password(self, user: User, data: PasswordChangeRequest) -> str:
        """Şifreyi değiştirir ve kullanıcının tüm oturumlarını sonlandırır; bu oturum için yeni token döndürür."""
        if not verify_password(data.current_password, user.password_hash):
            raise AppError(
                "Mevcut şifre hatalı.",
                code="INVALID_PASSWORD",
                details=[{"field": "current_password", "message": "Mevcut şifre hatalı."}],
            )
        user.password_hash = hash_password(data.new_password)
        self._end_sessions(user)
        return create_access_token(user.id, user.role.value, user.token_version)

    def logout(self, user: User) -> None:
        """Kullanıcının tüm cihazlardaki oturumlarını sonlandırır (token sürümü artar)."""
        self._end_sessions(user)

    def _end_sessions(self, user: User) -> None:
        # Artırma veritabanında yapılır; eşzamanlı iki istek aynı sürümü yazıp birbirini ezmez.
        user.token_version = User.token_version + 1
        self.db.commit()
        self.db.refresh(user)
