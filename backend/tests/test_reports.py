from datetime import date, datetime
from decimal import Decimal
from io import BytesIO

import pytest
from openpyxl import load_workbook

from app.core.clock import BUSINESS_TZ
from app.models import Order, OrderItem, OrderStatus, PaymentMethod
from app.schemas.report import SalesGroupBy
from app.services.report_service import ReportService
from tests.conftest import auth_headers


def at(day: int, hour: int = 12, month: int = 11) -> datetime:
    return datetime(2026, month, day, hour, tzinfo=BUSINESS_TZ)


@pytest.fixture
def sales(db, customer, make_category, make_product):
    office, tech = make_category("Ofis"), make_category("Teknoloji")
    paper = make_product(office, sku="R-PAPER", name="Kağıt", sale_price="10.00", cost_price="6.00")
    mouse = make_product(tech, sku="R-MOUSE", name="Mouse", sale_price="100.00", cost_price="70.00")
    counter = {"n": 0}

    def order(created_at, status, lines):
        counter["n"] += 1
        o = Order(
            order_code=f"REP-{counter['n']}",
            customer_id=customer.customer.id,
            status=status,
            payment_method=PaymentMethod.CREDIT_CARD,
            total_amount=sum((p.sale_price * q for p, q in lines), Decimal("0")),
            created_at=created_at,
        )
        for product, qty in lines:
            o.items.append(
                OrderItem(
                    product=product, quantity=qty, unit_price=product.sale_price, line_total=product.sale_price * qty
                )
            )
        db.add(o)

    order(at(2), OrderStatus.COMPLETED, [(paper, 10), (mouse, 1)])  # 100 + 100
    order(at(2, 1), OrderStatus.SHIPPED, [(paper, 5)])  # 50; İstanbul 01:00 = UTC önceki gün
    order(at(10), OrderStatus.PREPARING, [(mouse, 2)])  # 200
    order(at(11), OrderStatus.PENDING, [(mouse, 9)])  # sayılmaz
    order(at(12), OrderStatus.CANCELLED, [(paper, 99)])  # sayılmaz
    order(at(30, month=10), OrderStatus.COMPLETED, [(paper, 1)])  # aralık dışı
    db.flush()
    return office, tech


def test_daily_report_fills_days_and_totals(db, sales):
    report = ReportService(db).sales(date(2026, 11, 1), date(2026, 11, 10), SalesGroupBy.DAY)

    assert len(report.rows) == 10
    nov2 = next(r for r in report.rows if r.period == date(2026, 11, 2))
    assert (nov2.label, nov2.order_count, nov2.quantity, nov2.revenue) == ("02.11.2026", 2, 16, Decimal("250.00"))
    assert nov2.cost == Decimal("160.00")  # 15 kağıt × 6 + 1 mouse × 70
    assert nov2.gross_profit == Decimal("90.00")
    assert report.rows[0].revenue == Decimal("0")
    t = report.totals
    assert (t.order_count, t.quantity, t.revenue, t.cost, t.gross_profit) == (
        3,
        18,
        Decimal("450.00"),
        Decimal("300.00"),
        Decimal("150.00"),
    )


def test_weekly_and_monthly_labels(db, sales):
    weekly = ReportService(db).sales(date(2026, 11, 1), date(2026, 11, 14), SalesGroupBy.WEEK)
    monthly = ReportService(db).sales(date(2026, 10, 1), date(2026, 11, 30), SalesGroupBy.MONTH)

    assert [r.label for r in weekly.rows] == ["26.10.2026 haftası", "02.11.2026 haftası", "09.11.2026 haftası"]
    assert [(r.label, r.revenue) for r in monthly.rows] == [
        ("Ekim 2026", Decimal("10.00")),
        ("Kasım 2026", Decimal("450.00")),
    ]


def test_product_and_category_groups(db, sales):
    office, _ = sales
    by_product = ReportService(db).sales(date(2026, 11, 1), date(2026, 11, 30), SalesGroupBy.PRODUCT)
    by_category = ReportService(db).sales(date(2026, 11, 1), date(2026, 11, 30), SalesGroupBy.CATEGORY)
    office_only = ReportService(db).sales(date(2026, 11, 1), date(2026, 11, 30), SalesGroupBy.PRODUCT, office.id)

    assert [(r.label, r.quantity, r.order_count) for r in by_product.rows] == [
        ("R-MOUSE · Mouse", 3, 2),
        ("R-PAPER · Kağıt", 15, 2),
    ]
    assert by_product.totals.order_count == 3  # aynı sipariş iki satırda sayılsa da toplamda bir kez
    assert [r.label for r in by_category.rows] == ["Teknoloji", "Ofis"]
    assert [r.label for r in office_only.rows] == ["R-PAPER · Kağıt"]
    assert office_only.totals.order_count == 2


def test_invalid_range(client, admin):
    response = client.get(
        "/reports/sales", headers=auth_headers(admin), params={"from": "2026-11-10", "to": "2026-11-01"}
    )

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_RANGE"


def test_excel_export(client, admin, sales):
    response = client.get(
        "/reports/sales",
        headers=auth_headers(admin),
        params={"from": "2026-11-01", "to": "2026-11-30", "group_by": "category", "format": "xlsx"},
    )

    assert response.status_code == 200
    assert 'filename="satis-raporu-2026-11-01_2026-11-30.xlsx"' in response.headers["content-disposition"]
    sheet = load_workbook(BytesIO(response.content)).active
    values = [[cell.value for cell in row] for row in sheet.iter_rows(min_row=4)]
    assert values[0] == ["Kategori", "Sipariş Sayısı", "Satılan Adet", "Ciro", "Maliyet", "Brüt Kâr"]
    assert values[-1][:3] == ["Toplam", 3, 18]
    assert float(values[-1][3]) == 450.0


def test_reports_are_admin_only(client, warehouse):
    response = client.get(
        "/reports/sales", headers=auth_headers(warehouse), params={"from": "2026-11-01", "to": "2026-11-02"}
    )

    assert response.status_code == 403
