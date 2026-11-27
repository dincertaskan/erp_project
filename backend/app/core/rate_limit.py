"""Bir anahtar (ör. IP) için bellekte, kayan pencerede deneme sayısını sınırlar. Kayıt ucunda kullanılır.

Sayaçlar bellekte tutulur; uygulama yeniden başlatılınca sıfırlanır ve her uvicorn süreci kendi sayacını tutar.
Kaynak tüketimini önlemek için bu yeterlidir. Kaba kuvvete karşı kalıcı olması gereken hatalı giriş sayaçları
veritabanındadır (app.services.login_throttle).
"""

import time
from collections import defaultdict, deque
from threading import Lock

from app.core.config import settings


class MemoryRateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str) -> int:
        """Denemeyi sayar ve 0 döndürür; sınır dolmuşsa saymadan beklenecek saniyeyi döndürür.

        Kontrol ve sayma aynı kilit altında yapılır; eşzamanlı istekler sınırı aşamaz.
        """
        with self._lock:
            now = time.monotonic()
            attempts = self._attempts[key]
            while attempts and now - attempts[0] > self.window_seconds:
                attempts.popleft()
            if len(attempts) >= self.max_attempts:
                return int(self.window_seconds - (now - attempts[0])) + 1
            attempts.append(now)
            return 0

    def reset(self) -> None:
        with self._lock:
            self._attempts.clear()


register_throttle = MemoryRateLimiter(settings.REGISTER_RATE_LIMIT, settings.REGISTER_RATE_WINDOW_MINUTES * 60)
