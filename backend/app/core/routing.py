"""Senkron uç noktalarda veritabanı işlemini uç noktanın kendi iş parçacığında kapatan route sınıfı.

FastAPI senkron uç noktayı ve ardından yanıt doğrulamasını iş parçacığı havuzunda ayrı ayrı çalıştırır;
get_db oturumu ise yanıt gönderildikten sonra kapanır. Uç nokta dönerken son okuma işlemi açık kalırsa
bağlantı, serileştirme için iş parçacığı beklenirken tutulur. Yoğun yükte bağlantıyı tutan istekler iş
parçacığı, iş parçacığını tutanlar bağlantı bekler ve istekler havuz zaman aşımına (30 sn) kadar kilitlenir
(Deney 1, N=100'de gözlendi). Bu sınıf uç nokta döner dönmez açık işlemi kapatır; bağlantı havuza döner.
"""

from __future__ import annotations

import functools
import inspect
from collections.abc import Callable
from typing import Any

from fastapi.routing import APIRoute
from sqlalchemy.orm import Session


def release_sessions(endpoint: Callable[..., Any]) -> Callable[..., Any]:
    @functools.wraps(endpoint)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        result = endpoint(*args, **kwargs)
        for value in kwargs.values():
            # Yazmalar uç noktada zaten commit edilir; kalan işlem yalnızca okumadır. expire_on_commit=False
            # olduğu için yüklenmiş nesneler serileştirmede kullanılabilir kalır.
            if isinstance(value, Session) and value.in_transaction():
                value.commit()
        return result

    return wrapper


class SessionReleasingRoute(APIRoute):
    def __init__(self, path: str, endpoint: Callable[..., Any], **kwargs: Any) -> None:
        if not inspect.iscoroutinefunction(endpoint):
            endpoint = release_sessions(endpoint)
        super().__init__(path, endpoint, **kwargs)
