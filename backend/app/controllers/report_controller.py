from datetime import date
from enum import StrEnum

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.models import User, UserRole
from app.schemas.report import SalesGroupBy, SalesReport
from app.services.report_service import ReportService, sales_report_xlsx

router = APIRouter(prefix="/reports", tags=["Raporlar"])

admin_only = require_roles(UserRole.ADMIN)

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class ReportFormat(StrEnum):
    JSON = "json"
    XLSX = "xlsx"


@router.get(
    "/sales",
    response_model=SalesReport,
    responses={200: {"content": {XLSX: {}}, "description": "format=xlsx ile Excel dosyası"}},
)
def sales_report(
    date_from: date = Query(alias="from"),
    date_to: date = Query(alias="to"),
    group_by: SalesGroupBy = SalesGroupBy.DAY,
    category_id: int | None = None,
    format: ReportFormat = ReportFormat.JSON,
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    """Tarihler İstanbul saatine göre ve iki uç dahildir. Ciro: onaylanmış ve iptal edilmemiş siparişler.
    Maliyet ürünlerin güncel maliyetiyle hesaplanır."""
    report = ReportService(db).sales(date_from, date_to, group_by, category_id)
    if format == ReportFormat.XLSX:
        filename = f"satis-raporu-{date_from:%Y-%m-%d}_{date_to:%Y-%m-%d}.xlsx"
        return Response(
            content=sales_report_xlsx(report),
            media_type=XLSX,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    return report
