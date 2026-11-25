from datetime import date, datetime
from decimal import Decimal
from io import BytesIO

from openpyxl import load_workbook

from app.core.clock import BUSINESS_TZ
from app.models import Order, OrderItem, OrderStatus, PaymentMethod, StockMovement, StockMovementType
from app.services.operations_reports import OrderReportService, StockReportService, order_report_xlsx
from tests.conftest import auth_headers


def at(day: int, hour: int = 12) -> datetime:
    return datetime(2026, 11, day, hour, tzinfo=BUSINESS_TZ)


def move(db, product, user, movement_type, quantity, created_at):
    db.add(
        StockMovement(
            product_id=product.id,
            user_id=user.id,
            movement_type=movement_type,
            quantity=quantity,
            previous_stock=0,
            new_stock=0,
            created_at=created_at,
        )
    )
    db.flush()


def test_stock_report_reconstructs_opening_and_closing_stock(db, admin, make_category, make_product):
    category = make_category("Ofis")
    # Bugünkü stok 30. Hareketler: 5 Kasım +50 giriş, 8 Kasım -15 sipariş, 9 Kasım +3 iade, 20 Kasım -8 elle çıkış.
    product = make_product(category, sku="SR-1", stock=30, min_stock=40, cost_price="2.50")
    make_product(category, sku="SR-IDLE", stock=7, min_stock=1)
    move(db, product, admin, StockMovementType.IN, 50, at(5))
    move(db, product, admin, StockMovementType.ORDER_OUT, 15, at(8))
    move(db, product, admin, StockMovementType.CANCEL_RETURN, 3, at(9))
    move(db, product, admin, StockMovementType.OUT, 8, at(20))

    report = StockReportService(db).build(date(2026, 11, 6), date(2026, 11, 10))

    row = next(r for r in report.rows if r.sku == "SR-1")
    # Dönem sonu (10 Kasım) = 30 + 8 (20 Kasım çıkışı geri alınır) = 38; dönem başı = 38 - 3 + 15 = 50
    assert (row.opening_stock, row.stock_in, row.stock_out, row.closing_stock) == (50, 3, 15, 38)
    assert row.stock_value == Decimal("95.00")
    assert row.status == "Kritik"
    idle = next(r for r in report.rows if r.sku == "SR-IDLE")
    assert (idle.opening_stock, idle.closing_stock, idle.status) == (7, 7, "Yeterli")
    assert (report.totals.stock_in, report.totals.stock_out) == (3, 15)


def test_order_report_filters_status_and_pages(db, customer, make_product):
    product = make_product()
    for n, (day, status) in enumerate(
        [(3, OrderStatus.COMPLETED), (4, OrderStatus.PENDING), (5, OrderStatus.CANCELLED), (30, OrderStatus.COMPLETED)]
    ):
        order = Order(
            order_code=f"OR-{n}",
            customer_id=customer.customer.id,
            status=status,
            payment_method=PaymentMethod.BANK_TRANSFER,
            total_amount=Decimal("100"),
            created_at=at(day),
            approved_at=at(day, 14) if status == OrderStatus.COMPLETED else None,
        )
        order.items.append(OrderItem(product=product, quantity=1, unit_price=Decimal("100"), line_total=Decimal("100")))
        db.add(order)
    db.flush()

    everything = OrderReportService(db).build(date(2026, 11, 1), date(2026, 11, 10), [])
    completed = OrderReportService(db).build(date(2026, 11, 1), date(2026, 11, 10), [OrderStatus.COMPLETED])
    first_page = OrderReportService(db).build(date(2026, 11, 1), date(2026, 11, 10), [], page=1, page_size=2)

    assert [r.order_code for r in everything.rows] == ["OR-2", "OR-1", "OR-0"]
    assert (everything.total, everything.total_amount) == (3, Decimal("300"))
    assert [r.order_code for r in completed.rows] == ["OR-0"]
    assert completed.rows[0].approved_at.hour == 14  # İstanbul saatiyle
    assert completed.rows[0].customer == customer.customer.full_name
    assert (len(first_page.rows), first_page.total) == (2, 3)


def test_order_report_excel_warns_when_rows_are_truncated(db, customer, make_product):
    product = make_product()
    for n in range(3):
        order = Order(
            order_code=f"TR-{n}",
            customer_id=customer.customer.id,
            status=OrderStatus.PENDING,
            payment_method=PaymentMethod.BANK_TRANSFER,
            total_amount=Decimal("100"),
            created_at=at(3 + n),
        )
        order.items.append(OrderItem(product=product, quantity=2, unit_price=Decimal("50"), line_total=Decimal("100")))
        db.add(order)
    db.flush()
    service = OrderReportService(db)

    # Excel dosyası sınırla kesildiğinde (burada 2 satır) not ve toplam satırı bunu açıkça söyler.
    truncated = load_workbook(
        BytesIO(order_report_xlsx(service.build(date(2026, 11, 1), date(2026, 11, 10), [], page_size=2)))
    ).active
    full = load_workbook(BytesIO(order_report_xlsx(service.build(date(2026, 11, 1), date(2026, 11, 10), [])))).active

    assert truncated["A2"].value.startswith("İlk 2 sipariş gösterildi; toplam 3 sipariş.")
    assert [truncated.cell(row=r, column=1).value for r in (5, 6, 7)] == ["TR-2", "TR-1", "Toplam (3 siparişin tamamı)"]
    assert truncated["D5"].value == 1
    assert full["A2"].value == "3 sipariş. Tarihler İstanbul saatine göredir."
    assert full["A8"].value == "Toplam"


def test_report_endpoints_and_excel(client, admin, warehouse, make_product):
    make_product(sku="EX-1")
    params = {"from": "2026-11-01", "to": "2026-11-21"}

    stock = client.get("/reports/stock", headers=auth_headers(admin), params=params)
    orders_xlsx = client.get("/reports/orders", headers=auth_headers(admin), params={**params, "format": "xlsx"})
    stock_xlsx = client.get("/reports/stock", headers=auth_headers(admin), params={**params, "format": "xlsx"})

    assert stock.status_code == 200
    assert [r["sku"] for r in stock.json()["rows"]] == ["EX-1"]
    assert "siparis-raporu-2026-11-01_2026-11-21.xlsx" in orders_xlsx.headers["content-disposition"]
    sheet = load_workbook(BytesIO(stock_xlsx.content)).active
    assert [c.value for c in sheet[4]][:3] == ["SKU", "Ürün", "Kategori"]
    assert sheet[5][0].value == "EX-1"
    assert client.get("/reports/orders", headers=auth_headers(warehouse), params=params).status_code == 403
