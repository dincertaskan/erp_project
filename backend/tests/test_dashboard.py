from datetime import date, datetime
from decimal import Decimal

import pytest

from app.core.clock import BUSINESS_TZ
from app.models import Order, OrderItem, OrderStatus, PaymentMethod
from app.schemas.dashboard import Granularity, Period
from app.services.dashboard_service import DashboardService
from tests.conftest import auth_headers

NOW = datetime(2026, 11, 21, 15, 0, tzinfo=BUSINESS_TZ)  # Cumartesi


def local(year, month, day, hour=12, minute=0):
    return datetime(year, month, day, hour, minute, tzinfo=BUSINESS_TZ)


@pytest.fixture
def add_order(db, customer):
    counter = {"n": 0}

    def factory(created_at: datetime, status: OrderStatus, lines: list[tuple]) -> Order:
        counter["n"] += 1
        order = Order(
            order_code=f"DASH-{counter['n']}",
            customer_id=customer.customer.id,
            status=status,
            payment_method=PaymentMethod.CREDIT_CARD,
            total_amount=sum((Decimal(price) * qty for _, qty, price in lines), Decimal("0")),
            created_at=created_at,
        )
        for product, qty, price in lines:
            order.items.append(
                OrderItem(product=product, quantity=qty, unit_price=Decimal(price), line_total=Decimal(price) * qty)
            )
        db.add(order)
        db.flush()
        return order

    return factory


@pytest.fixture
def sales(add_order, make_product):
    keyboard = make_product(sku="D-KB", name="Klavye")
    mouse = make_product(sku="D-MS", name="Mouse")
    add_order(local(2026, 11, 21, 10), OrderStatus.COMPLETED, [(keyboard, 1, "100")])
    # İstanbul'da gece 01:00 = UTC'de önceki gün 22:00; yine de bugünün satışıdır.
    add_order(local(2026, 11, 21, 1), OrderStatus.PREPARING, [(mouse, 2, "25")])
    add_order(local(2026, 11, 20, 23, 30), OrderStatus.SHIPPED, [(mouse, 3, "10")])
    add_order(local(2026, 11, 21, 11), OrderStatus.PENDING, [(keyboard, 9, "111")])
    add_order(local(2026, 11, 21, 12), OrderStatus.CANCELLED, [(keyboard, 5, "100")])
    add_order(local(2026, 11, 3), OrderStatus.COMPLETED, [(keyboard, 2, "100")])
    add_order(local(2026, 10, 5), OrderStatus.COMPLETED, [(mouse, 7, "10")])
    add_order(local(2026, 10, 25), OrderStatus.COMPLETED, [(keyboard, 10, "100")])
    return keyboard, mouse


def test_summary_counts_only_approved_orders_in_business_time(db, sales, make_product):
    make_product(stock=1, min_stock=5)

    summary = DashboardService(db, now=NOW).summary()

    assert summary.today_sales == Decimal("150")
    assert summary.today_order_count == 2
    assert summary.yesterday_sales == Decimal("30")
    assert summary.month_sales == Decimal("380")
    # Geçen ayın aynı aralığı (1-21 Ekim): 25 Ekim'deki sipariş dahil değil.
    assert summary.prev_month_sales == Decimal("70")
    assert summary.pending_orders == 1
    assert summary.critical_stock_count == 1


def test_daily_trend_fills_empty_days(db, sales):
    trend = DashboardService(db, now=NOW).sales_trend(Granularity.DAY)

    assert len(trend) == 30
    assert trend[0].date == date(2026, 10, 23)
    by_day = {point.date: point for point in trend}
    assert (by_day[date(2026, 11, 21)].amount, by_day[date(2026, 11, 21)].order_count) == (Decimal("150"), 2)
    assert by_day[date(2026, 11, 20)].amount == Decimal("30")
    assert by_day[date(2026, 11, 19)].amount == Decimal("0")


def test_monthly_trend(db, sales):
    trend = DashboardService(db, now=NOW).sales_trend(Granularity.MONTH)

    assert len(trend) == 12
    assert trend[0].date == date(2025, 12, 1)
    assert (trend[-1].date, trend[-1].amount) == (date(2026, 11, 1), Decimal("380"))
    assert trend[-2].amount == Decimal("1070")


def test_top_products_by_period(db, sales):
    keyboard, mouse = sales
    service = DashboardService(db, now=NOW)

    today = service.top_products(Period.TODAY, 5)
    week = service.top_products(Period.WEEK, 5)
    month = service.top_products(Period.MONTH, 1)

    assert [(p.sku, p.quantity) for p in today] == [("D-MS", 2), ("D-KB", 1)]
    assert [(p.sku, p.quantity, p.revenue) for p in week] == [("D-MS", 5, Decimal("80")), ("D-KB", 1, Decimal("100"))]
    assert [(p.sku, p.quantity) for p in month] == [("D-MS", 5)]


def test_endpoints_are_admin_only(client, admin, warehouse):
    for path in ("/dashboard/summary", "/dashboard/sales-trend?granularity=month", "/dashboard/top-products"):
        assert client.get(path, headers=auth_headers(admin)).status_code == 200
        assert client.get(path, headers=auth_headers(warehouse)).status_code == 403


def test_empty_database_returns_zeros(client, admin):
    body = client.get("/dashboard/summary", headers=auth_headers(admin)).json()

    assert body["today_sales"] == "0"
    assert len(client.get("/dashboard/sales-trend", headers=auth_headers(admin)).json()) == 30
