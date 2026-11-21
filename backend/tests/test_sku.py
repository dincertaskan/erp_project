import pytest

from app.services.sku import next_sku, sku_prefix


@pytest.mark.parametrize(
    ("name", "prefix"),
    [
        ("Elektronik", "ELK"),
        ("Ofis Malzemeleri", "OFS"),
        ("Yedek Parça", "YDK"),
        ("Çiçek", "CCK"),
        ("Su", "SUX"),
        ("İçecek", "ICC"),
        ("123", "URN"),
    ],
)
def test_prefix_uses_first_letter_and_consonants(name, prefix):
    assert sku_prefix(name) == prefix


def test_next_sku_continues_after_the_highest_number():
    assert next_sku("ELK", ["ELK-0001", "ELK-0007", "ELK-ABC", "ELKX-0100"]) == "ELK-0008"
    assert next_sku("OFS", []) == "OFS-0001"
