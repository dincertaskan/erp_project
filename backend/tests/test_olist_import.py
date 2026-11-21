import csv
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.models import Category, Customer, Order, OrderStatus, PaymentMethod, Product, RecordSource, StockMovement
from app.olist.importer import OlistError, OlistImporter, Summary


def write(path, header, rows):
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


@pytest.fixture
def olist_dir(tmp_path):
    write(
        tmp_path / "olist_orders_dataset.csv",
        [
            "order_id",
            "customer_id",
            "order_status",
            "order_purchase_timestamp",
            "order_approved_at",
            "order_delivered_carrier_date",
            "order_delivered_customer_date",
            "order_estimated_delivery_date",
        ],
        [
            [
                "o1",
                "c1",
                "delivered",
                "2017-01-05 10:00:00",
                "2017-01-05 11:00:00",
                "2017-01-06 09:00:00",
                "2017-01-09 15:00:00",
                "",
            ],
            ["o2", "c2", "canceled", "2017-02-01 08:00:00", "", "", "", ""],
            ["o3", "c3", "shipped", "2017-03-01 23:30:00", "2017-03-02 08:00:00", "2017-03-03 08:00:00", "", ""],
            ["o4", "c1", "unavailable", "2017-03-10 10:00:00", "", "", "", ""],  # kalemsiz
        ],
    )
    write(
        tmp_path / "olist_order_items_dataset.csv",
        ["order_id", "order_item_id", "product_id", "seller_id", "shipping_limit_date", "price", "freight_value"],
        [
            ["o1", "1", "p-aaaaaaaaaaaaaaaa", "s", "", "10.00", "5"],
            ["o1", "2", "p-aaaaaaaaaaaaaaaa", "s", "", "10.00", "5"],
            ["o1", "3", "p-bbbbbbbbbbbbbbbb", "s", "", "99.90", "5"],
            ["o2", "1", "p-bbbbbbbbbbbbbbbb", "s", "", "89.90", "5"],
            ["o3", "1", "p-aaaaaaaaaaaaaaaa", "s", "", "12.00", "5"],
        ],
    )
    write(
        tmp_path / "olist_products_dataset.csv",
        ["product_id", "product_category_name"],
        [["p-aaaaaaaaaaaaaaaa", "papelaria"], ["p-bbbbbbbbbbbbbbbb", "categoria_nova"]],
    )
    write(
        tmp_path / "olist_customers_dataset.csv",
        ["customer_id", "customer_unique_id", "customer_zip_code_prefix", "customer_city", "customer_state"],
        [
            ["c1", "u1", "01000", "sao paulo", "SP"],
            ["c2", "u2", "20000", "rio de janeiro", "RJ"],
            ["c3", "u1", "01000", "sao paulo", "SP"],  # aynı kişi, farklı sipariş müşteri kimliği
        ],
    )
    write(
        tmp_path / "product_category_name_translation.csv",
        ["product_category_name", "product_category_name_english"],
        [["papelaria", "stationery"], ["categoria_nova", "new_category"]],
    )
    write(
        tmp_path / "olist_order_payments_dataset.csv",
        ["order_id", "payment_sequential", "payment_type", "payment_installments", "payment_value"],
        [["o1", "1", "boleto", "1", "119.90"], ["o3", "1", "credit_card", "1", "12.00"]],
    )
    return tmp_path


def load(db, path, **kwargs) -> Summary:
    return OlistImporter(db, path, log=lambda _: None).load(**kwargs)


def olist_orders(db):
    return {o.external_id: o for o in db.scalars(select(Order).where(Order.source == RecordSource.OLIST))}


def test_import_maps_orders_products_customers_and_categories(db, olist_dir):
    summary = load(db, olist_dir)

    assert (summary.orders, summary.order_items, summary.products, summary.customers) == (3, 4, 2, 2)
    assert summary.skipped_orders == 1
    orders = olist_orders(db)
    first = orders["o1"]
    assert first.order_code == "OL-o1"
    assert first.status == OrderStatus.COMPLETED
    assert first.total_amount == Decimal("119.90")
    assert first.payment_method == PaymentMethod.BANK_TRANSFER
    assert first.created_at.isoformat().startswith("2017-01-05T12:00:00")  # São Paulo 10:00 = UTC 12:00
    assert first.completed_at is not None
    assert first.created_by_id is None
    items = {i.product.external_id: i for i in first.items}
    assert (items["p-aaaaaaaaaaaaaaaa"].quantity, items["p-aaaaaaaaaaaaaaaa"].line_total) == (2, Decimal("20.00"))
    assert orders["o2"].status == OrderStatus.CANCELLED
    assert orders["o3"].status == OrderStatus.SHIPPED
    assert orders["o3"].completed_at is None

    # Aynı customer_unique_id tek müşteri olur.
    assert orders["o1"].customer_id == orders["o3"].customer_id
    customer = db.get(Customer, orders["o1"].customer_id)
    assert customer.email.endswith("@example.com")
    assert customer.city == "Sao Paulo / SP"
    assert customer.user_id is None

    paper = db.scalar(select(Product).where(Product.external_id == "p-aaaaaaaaaaaaaaaa"))
    assert paper.sku == "OL-P-AAAAAAAAAA"
    assert paper.category.name == "Kırtasiye"
    assert paper.sale_price == Decimal("10.00")  # 10, 10, 12 → medyan 10
    assert paper.cost_price == Decimal("6.00")
    assert paper.min_stock >= 2
    unknown = db.scalar(select(Product).where(Product.external_id == "p-bbbbbbbbbbbbbbbb"))
    assert unknown.category.name == "New Category"

    # Karar 14: Olist siparişleri için stok hareketi üretilmez.
    assert db.scalar(select(func.count()).select_from(StockMovement)) == 0


def test_existing_category_is_reused(db, olist_dir, make_category):
    stationery = make_category("Kırtasiye")

    summary = load(db, olist_dir)

    paper = db.scalar(select(Product).where(Product.external_id == "p-aaaaaaaaaaaaaaaa"))
    assert paper.category_id == stationery.id
    assert summary.categories == 1


def test_sample_loads_the_oldest_orders(db, olist_dir):
    summary = load(db, olist_dir, sample=1)

    assert summary.orders == 1
    assert list(olist_orders(db)) == ["o1"]


def test_scale_copies_orders_into_the_past(db, olist_dir):
    load(db, olist_dir, scale=2)

    orders = olist_orders(db)
    assert set(orders) == {"o1", "o2", "o3", "o1-S1", "o2-S1", "o3-S1"}
    assert orders["o1-S1"].created_at < orders["o1"].created_at
    assert orders["o1-S1"].order_code == "OL-o1-S1"


def test_reset_removes_olist_records_and_empty_categories(db, olist_dir):
    importer = OlistImporter(db, olist_dir, log=lambda _: None)
    importer.load()
    assert importer.already_loaded()

    summary = Summary()
    importer.reset(summary)

    assert not importer.already_loaded()
    assert summary.deleted["orders"] == 3
    assert db.scalar(select(func.count()).where(Product.source == RecordSource.OLIST)) == 0
    assert db.scalar(select(Category).where(Category.name == "Kırtasiye")) is None
    importer.load()
    assert len(olist_orders(db)) == 3


def test_missing_files_are_reported(db, tmp_path):
    with pytest.raises(OlistError, match="olist_orders_dataset.csv"):
        OlistImporter(db, tmp_path).check_files()
