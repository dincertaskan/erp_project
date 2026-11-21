"""Art arda hatalı giriş denemelerini sınırlar.

Sayaçlar bellekte tutulur; uygulama yeniden başlatılınca sıfırlanır ve her
uvicorn süreci kendi sayacını tutar. Bu projenin ölçeği için yeterlidir.
"""

import time
from collections import defaultdict, deque
from threading import Lock

MAX_FAILED_ATTEMPTS = 5
WINDOW_SECONDS = 15 * 60


class LoginThrottle:
    def __init__(self, max_attempts: int = MAX_FAILED_ATTEMPTS, window_seconds: int = WINDOW_SECONDS):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        attempts = self._failures[key]
        while attempts and now - attempts[0] > self.window_seconds:
            attempts.popleft()
        return attempts

    def retry_after(self, key: str) -> int:
        """Engelliyse kaç saniye beklenmesi gerektiğini, değilse 0 döndürür."""
        with self._lock:
            now = time.monotonic()
            attempts = self._prune(key, now)
            if len(attempts) < self.max_attempts:
                return 0
            return int(self.window_seconds - (now - attempts[0])) + 1

    def record_failure(self, key: str) -> None:
        with self._lock:
            self._failures[key].append(time.monotonic())

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._failures.clear()
            else:
                self._failures.pop(key, None)


login_throttle = LoginThrottle()
