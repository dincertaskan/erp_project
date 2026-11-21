from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Category, Product


@pytest.fixture
def category(db):
    category = Category(name="Test Kategori")
    db.add(category)
    db.flush()
    return category


def make_product(category, **overrides):
    data = {"sku": "TST-0001", "name": "Test Ürün", "category": category, "sale_price": Decimal("10.00")}
    return Product(**(data | overrides))


def test_stock_cannot_be_negative(db, category):
    db.add(make_product(category, stock=-1))

    with pytest.raises(IntegrityError, match="ck_products_stock_non_negative"):
        db.flush()


def test_sale_price_cannot_be_negative(db, category):
    db.add(make_product(category, sale_price=Decimal("-1.00")))

    with pytest.raises(IntegrityError, match="ck_products_sale_price_non_negative"):
        db.flush()


def test_sku_is_unique(db, category):
    db.add(make_product(category))
    db.flush()
    db.add(make_product(category, name="Başka Ürün"))

    with pytest.raises(IntegrityError, match="uq_products_sku"):
        db.flush()


def test_critical_stock_means_below_minimum(category):
    assert make_product(category, stock=4, min_stock=5).is_critical
    assert not make_product(category, stock=5, min_stock=5).is_critical
