from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ klasörü; uygulama hangi klasörden başlatılırsa başlatılsın aynı yolları kullanırız
BASE_DIR = Path(__file__).resolve().parents[2]

DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

SECRET_KEY_MIN_LENGTH = 32
# Örnek dosyalardaki yer tutucular; kopyalanıp değiştirilmeden kullanılırsa tokenlar tahmin edilebilir.
PLACEHOLDER_SECRET_KEYS = frozenset({"change-me-to-a-long-random-string", "change-me", "changeme", "secret"})


class Settings(BaseSettings):
    """Ortam değişkenlerinden (veya backend/.env dosyasından) okunan ayarlar.

    Zorunlu bir değer eksikse uygulama açılışta anlaşılır bir hatayla durur.
    """

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str
    SECRET_KEY: str
    # Yalnızca HMAC algoritmaları; "none" ya da açık anahtar algoritmaları yapılandırmayla seçilemez.
    ALGORITHM: Literal["HS256", "HS384", "HS512"] = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    # Virgülle ayrılmış ek frontend adresleri (ör. http://192.168.1.20:5173)
    CORS_ORIGINS: str = ""
    # Deney 1: stok güncellemelerinde kötümser (SELECT ... FOR UPDATE) ya da iyimser (sürüm numarası) kilit.
    # "none" yalnızca deneyde referans içindir (kilitsiz oku-kontrol et-yaz; fazla satışa açıktır).
    # Bağlantı havuzu (worker başına). worker × (havuz + taşma), PostgreSQL max_connections'ın altında kalmalı.
    DB_POOL_SIZE: int = Field(5, ge=1)
    DB_MAX_OVERFLOW: int = Field(10, ge=0)
    DB_POOL_TIMEOUT: int = Field(30, ge=1)
    STOCK_STRATEGY: Literal["pessimistic", "optimistic", "none"] = "pessimistic"

    @field_validator("DATABASE_URL")
    @classmethod
    def normalize_database_url(cls, url: str) -> str:
        # Sürücü belirtilmemişse (postgresql:// veya postgres://) psycopg 3 kullan.
        # Eski postgresql+psycopg2:// adresleri de psycopg 3'e yönlendirilir.
        for prefix in ("postgres://", "postgresql://", "postgresql+psycopg2://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix) :]
        return url

    @field_validator("SECRET_KEY")
    @classmethod
    def strong_secret_key(cls, key: str) -> str:
        hint = 'Üretmek için: python -c "import secrets; print(secrets.token_urlsafe(32))"'
        if key.strip().lower() in PLACEHOLDER_SECRET_KEYS:
            raise ValueError(f"SECRET_KEY örnek dosyadaki yer tutucu değer olamaz. {hint}")
        if len(key) < SECRET_KEY_MIN_LENGTH:
            raise ValueError(f"SECRET_KEY en az {SECRET_KEY_MIN_LENGTH} karakter olmalıdır. {hint}")
        return key

    @property
    def cors_origins(self) -> list[str]:
        extra = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        return [*DEFAULT_CORS_ORIGINS, *extra]


settings = Settings()
