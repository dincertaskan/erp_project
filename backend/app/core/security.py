from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import settings

# bcrypt en fazla 72 baytı dikkate alır; daha uzun şifreler bu sınırda kesilir.
_BCRYPT_MAX_BYTES = 72


def _password_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_password_bytes(plain_password), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int, role: str, token_version: int) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "role": role,
        # Kullanıcının token sürümü; çıkış ya da şifre değişikliği sürümü artırınca bu token geçersizleşir.
        "ver": token_version,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> tuple[int, int] | None:
    """İmzası ve süresi geçerli bir token için (kullanıcı kimliği, token sürümü), aksi halde None döndürür.

    Sürümün kullanıcının güncel sürümüyle eşleştiği get_current_user'da denetlenir.
    """
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM], options={"require": ["sub", "exp", "ver"]}
        )
        return int(payload["sub"]), int(payload["ver"])
    except (jwt.PyJWTError, ValueError, TypeError):
        return None
