from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ klasörü; uygulama hangi klasörden başlatılırsa başlatılsın aynı yolları kullanırız
BASE_DIR = Path(__file__).resolve().parents[2]

DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


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
    SECRET_KEY: str = Field(min_length=16)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    # Virgülle ayrılmış ek frontend adresleri (ör. http://192.168.1.20:5173)
    CORS_ORIGINS: str = ""

    @field_validator("DATABASE_URL")
    @classmethod
    def normalize_database_url(cls, url: str) -> str:
        # Sürücü belirtilmemişse (postgresql:// veya postgres://) psycopg 3 kullan.
        # Eski postgresql+psycopg2:// adresleri de psycopg 3'e yönlendirilir.
        for prefix in ("postgres://", "postgresql://", "postgresql+psycopg2://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix) :]
        return url

    @property
    def cors_origins(self) -> list[str]:
        extra = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        return [*DEFAULT_CORS_ORIGINS, *extra]


settings = Settings()
