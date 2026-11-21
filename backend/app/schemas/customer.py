from datetime import datetime

from app.models import RecordSource
from app.schemas.common import ApiModel


class CustomerListItem(ApiModel):
    id: int
    full_name: str
    email: str
    phone: str | None
    company_name: str | None
    address: str | None
    city: str | None
    is_active: bool
    source: RecordSource
    created_at: datetime
