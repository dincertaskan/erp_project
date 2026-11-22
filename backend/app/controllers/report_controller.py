from datetime import date
from enum import StrEnum

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.routing import SessionReleasingRoute
from app.models import OrderStatus, User, UserRole
from app.schemas.report import OrderReport, SalesGroupBy, SalesReport, StockReport
from app.services.operations_reports import (
    OrderReportService,
    StockReportService,
    order_report_xlsx,
    stock_report_xlsx,
)
from app.services.report_service import ReportService, sales_report_xlsx

router = APIRouter(prefix="/reports", tags=["Raporlar"], route_class=SessionReleasingRoute)

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


def _xlsx(content: bytes, name: str, date_from: date, date_to: date) -> Response:
    filename = f"{name}-{date_from:%Y-%m-%d}_{date_to:%Y-%m-%d}.xlsx"
    return Response(
        content=content, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get(
    "/stock",
    response_model=StockReport,
    responses={200: {"content": {XLSX: {}}, "description": "format=xlsx ile Excel dosyası"}},
)
def stock_report(
    date_from: date = Query(alias="from"),
    date_to: date = Query(alias="to"),
    category_id: int | None = None,
    format: ReportFormat = ReportFormat.JSON,
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    """Aktif ürünlerin dönem başı/sonu stoğu ve dönem içi giriş-çıkışları; stok değeri güncel maliyetle."""
    report = StockReportService(db).build(date_from, date_to, category_id)
    if format == ReportFormat.XLSX:
        return _xlsx(stock_report_xlsx(report), "stok-raporu", date_from, date_to)
    return report


@router.get(
    "/orders",
    response_model=OrderReport,
    responses={200: {"content": {XLSX: {}}, "description": "format=xlsx ile Excel dosyası (tüm satırlar)"}},
)
def order_report(
    date_from: date = Query(alias="from"),
    date_to: date = Query(alias="to"),
    status: list[OrderStatus] = Query(default=[]),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    format: ReportFormat = ReportFormat.JSON,
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    service = OrderReportService(db)
    if format == ReportFormat.XLSX:
        return _xlsx(order_report_xlsx(service.build(date_from, date_to, status)), "siparis-raporu", date_from, date_to)
    return service.build(date_from, date_to, status, page=page, page_size=page_size)
