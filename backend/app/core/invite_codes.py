"""Müşteri kartı davet kodları.

Yöneticinin uygulamada açtığı bir müşteri kartı, aynı e-postayla kayıt olan kişiye ancak yöneticinin ürettiği
davet koduyla bağlanır; e-posta doğrulaması yerine geçer. Kod tek kullanımlıktır, INVITE_TTL sonra geçersiz olur
ve veritabanında yalnızca SECRET_KEY ile anahtarlanmış özeti saklanır. SECRET_KEY değişirse açık kodlar geçersizleşir.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from app.core import clock
from app.core.config import settings

if TYPE_CHECKING:
    from app.models import Customer

INVITE_TTL = timedelta(days=7)
# Telefonda okunup elle yazılabilsin diye birbirine benzeyen karakterler (0/O, 1/I/L) kullanılmaz.
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 10  # 31^10 ≈ 2^49 olasılık
_SEPARATORS = re.compile(r"[\s-]")


def generate() -> str:
    """Okunaklı biçimde yeni kod: ABCDE-FGH23."""
    raw = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))
    return f"{raw[:5]}-{raw[5:]}"


def normalize(code: str) -> str:
    """Kullanıcının yazdığı kodu karşılaştırılabilir hale getirir: boşluk ve tire silinir, büyük harfe çevrilir."""
    return _SEPARATORS.sub("", code).upper()


def digest(code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), normalize(code).encode(), hashlib.sha256).hexdigest()


def matches(code: str, stored_digest: str) -> bool:
    return hmac.compare_digest(digest(code), stored_digest)


# --- Müşteri kartı üzerindeki kod ---


def issue(customer: Customer) -> str:
    """Karta yeni kod üretir; önceki kod geçersizleşir. Düz kod yalnızca burada döner, saklanmaz."""
    code = generate()
    customer.invite_code_digest = digest(code)
    customer.invite_expires_at = clock.now() + INVITE_TTL
    return code


def revoke(customer: Customer) -> None:
    customer.invite_code_digest = None
    customer.invite_expires_at = None


def active_until(customer: Customer) -> datetime | None:
    """Kullanılabilir bir kod varsa son geçerlilik zamanı."""
    if customer.invite_code_digest is None or customer.invite_expires_at is None:
        return None
    return customer.invite_expires_at if customer.invite_expires_at > clock.now() else None


def accepts(customer: Customer, code: str) -> bool:
    """Kod bu kart için geçerli mi: eşleşir, süresi dolmamış, kart aktif ve henüz bir hesaba bağlı değil."""
    if active_until(customer) is None or not customer.is_active or customer.user_id is not None:
        return False
    return matches(code, customer.invite_code_digest)
