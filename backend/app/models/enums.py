import enum

from sqlalchemy import Enum


class UserRole(enum.StrEnum):
    ADMIN = "admin"
    WAREHOUSE = "warehouse"
    CUSTOMER = "customer"


class OrderStatus(enum.StrEnum):
    PENDING = "pending"  # Onay Bekliyor
    PREPARING = "preparing"  # Hazırlanıyor
    SHIPPED = "shipped"  # Kargolandı
    COMPLETED = "completed"  # Tamamlandı
    CANCELLED = "cancelled"  # İptal


class PaymentMethod(enum.StrEnum):
    CREDIT_CARD = "credit_card"  # Kredi Kartı
    BANK_TRANSFER = "bank_transfer"  # Havale/EFT
    CASH_ON_DELIVERY = "cash_on_delivery"  # Kapıda Ödeme


class StockMovementType(enum.StrEnum):
    IN = "in"  # Elle stok girişi
    OUT = "out"  # Elle stok çıkışı
    ORDER_OUT = "order_out"  # Sipariş onayında otomatik çıkış
    CANCEL_RETURN = "cancel_return"  # Hazırlanıyor durumundaki siparişin iptalinde iade


class RecordSource(enum.StrEnum):
    APP = "app"
    OLIST = "olist"


def pg_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    """Veritabanında enum'un adını değil değerini saklayan PostgreSQL enum tipi."""
    return Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e], validate_strings=True)
