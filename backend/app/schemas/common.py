from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.core.clock import as_business_time

# Sorgu parametrelerindeki tarih-saat; "2026-03-01T00:00" gibi saat dilimsiz değerler İstanbul saatidir.
BusinessDateTime = Annotated[datetime, AfterValidator(as_business_time)]


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RequestModel(BaseModel):
    """İstek gövdeleri: tanımsız alanlar reddedilir, metinlerin baştaki ve sondaki boşlukları silinir."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


# Çok büyük sayfa numarası OFFSET'i bigint sınırının ötesine taşıyıp veritabanı hatasına yol açar.
MAX_PAGE = 100_000


class PageParams(BaseModel):
    page: int = Field(1, ge=1, le=MAX_PAGE)
    page_size: int = Field(20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
