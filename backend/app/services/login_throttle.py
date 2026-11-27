"""Hatalı giriş denemelerini e-posta ve IP başına sınırlar.

- Aynı e-postaya 15 dakikada 5 hatalı deneme: o e-postayla giriş engellenir (hesaba yönelik tahmin).
- Aynı IP'den 15 dakikada 20 hatalı deneme (e-postalar farklı olsa da): o IP engellenir (çok hesaba yayılan
  kaba kuvvet).

Sayaçlar login_attempts tablosundadır; uygulama yeniden başlayınca korunur, tüm uvicorn süreçleri aynı sayacı görür.
Kontrol ve yazma ayrı adımlar olduğundan eşzamanlı isteklerde sınır birkaç deneme aşılabilir; amaç tahmini
pratikte imkânsız kılmaktır, tam sayım değil.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import ColumnElement, delete, select
from sqlalchemy.orm import Session

from app.models import LoginAttempt

MAX_FAILURES_PER_EMAIL = 5
MAX_FAILURES_PER_IP = 20
WINDOW = timedelta(minutes=15)


class LoginThrottle:
    def __init__(self, db: Session):
        self.db = db

    def retry_after(self, email: str, ip_address: str) -> int:
        """Engelliyse kaç saniye beklenmesi gerektiğini, değilse 0 döndürür."""
        now = datetime.now(UTC)
        return max(
            self._wait(LoginAttempt.email == email.lower(), MAX_FAILURES_PER_EMAIL, now),
            self._wait(LoginAttempt.ip_address == ip_address, MAX_FAILURES_PER_IP, now),
        )

    def _wait(self, condition: ColumnElement[bool], limit: int, now: datetime) -> int:
        # Penceredeki denemelerin en yenisinden sayınca limit'inci olan düşünce sayı sınırın altına iner.
        oldest_counted = self.db.scalar(
            select(LoginAttempt.created_at)
            .where(condition, LoginAttempt.created_at > now - WINDOW)
            .order_by(LoginAttempt.created_at.desc())
            .offset(limit - 1)
            .limit(1)
        )
        if oldest_counted is None:
            return 0
        return int((oldest_counted + WINDOW - now).total_seconds()) + 1

    def record_failure(self, email: str, ip_address: str) -> None:
        now = datetime.now(UTC)
        # Pencereden eski kayıtlar artık sayılmaz; tablo büyümesin diye burada silinir.
        self.db.execute(delete(LoginAttempt).where(LoginAttempt.created_at <= now - WINDOW))
        self.db.add(LoginAttempt(email=email.lower(), ip_address=ip_address, created_at=now))

    def reset(self, email: str) -> None:
        """Başarılı girişten sonra o e-postanın sayacı sıfırlanır.

        Aynı IP'den öteki e-postalara yapılan denemeler kalır; kendi hesabına girmek IP sayacını temizlemez.
        """
        self.db.execute(delete(LoginAttempt).where(LoginAttempt.email == email.lower()))
