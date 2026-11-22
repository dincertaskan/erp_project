from pydantic import BaseModel, ConfigDict, Field


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


class PageParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
