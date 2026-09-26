import uuid
from sqlalchemy.orm import Session, joinedload
from app.models.erp import Order, OrderItem, Product, StockMovement
from app.schemas.order_schema import OrderCreate

class OrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all_orders(self):
        orders = self.db.query(Order).options(joinedload(Order.items).joinedload(OrderItem.product)).order_by(Order.id.desc()).all()
        result = []
        for o in orders:
            items_payload = []
            for item in o.items:
                items_payload.append({
                    "id": item.id,
                    "product_id": item.product_id,
                    "product_name": item.product.name if item.product else "Bilinmeyen Ürün",
                    "quantity": item.quantity,
                    "unit_price": float(item.unit_price),
                    "total_price": float(item.total_price)
                })
            
            result.append({
                "id": o.id,
                "order_code": o.order_code,
                "customer_name": o.customer_name,
                "total_price": float(o.total_price),
                "payment_method": o.payment_method,
                "payment_status": o.payment_status,
                "order_status": o.order_status,
                "note": o.note,
                "created_at": o.created_at,
                "items": items_payload,
                "product_name": items_payload[0]["product_name"] if items_payload else "Çoklu Ürün",
                "quantity": sum(i["quantity"] for i in items_payload)
            })
        return result

    def create_order(self, data: OrderCreate, user_name: str = "Sistem"):
        if not data.items:
            raise ValueError("Sipariş için en az 1 ürün seçilmelidir.")

        grand_total = 0
        order_items_to_add = []

        # 1. Stok Kontrolü ve Fiyat Hesaplama
        for item_data in data.items:
            product = self.db.query(Product).filter(Product.id == item_data.product_id).first()
            if not product:
                raise ValueError(f"ID:{item_data.product_id} olan ürün bulunamadı.")
            
            if product.stock < item_data.quantity:
                raise ValueError(f"'{product.name}' için yetersiz stok! Mevcut: {product.stock} Adet")

            item_total = float(product.unit_price) * item_data.quantity
            grand_total += item_total

            # Stok Düşürme ve Loglama
            prev_stock = product.stock
            product.stock -= item_data.quantity
            
            movement = StockMovement(
                product_id=product.id,
                user_name=user_name,
                action_type="AZALT",
                quantity=item_data.quantity,
                previous_stock=prev_stock,
                new_stock=product.stock,
                description=f"Sipariş satışı yapıldı (Sipariş Kodu Otomatik Oluşturuluyor)"
            )
            self.db.add(movement)

            order_items_to_add.append({
                "product_id": product.id,
                "quantity": item_data.quantity,
                "unit_price": product.unit_price,
                "total_price": item_total
            })

        # 2. Ana Siparişi Oluştur
        unique_code = f"{uuid.uuid4().hex[:6].upper()}"
        new_order = Order(
            order_code=unique_code,
            customer_name=data.customer_name or "Misafir Müşteri",
            total_price=grand_total,
            payment_method=data.payment_method,
            payment_status="Ödendi",
            order_status="Hazırlanıyor",
            note=data.note
        )
        self.db.add(new_order)
        self.db.commit()
        self.db.refresh(new_order)

        # 3. Sipariş Kalemlerini Ekle
        for item in order_items_to_add:
            order_item = OrderItem(
                order_id=new_order.id,
                product_id=item["product_id"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                total_price=item["total_price"]
            )
            self.db.add(order_item)

        self.db.commit()
        return self.get_all_orders()[0] # En son oluşturulanı döndür

    def update_order_status(self, order_id: int, new_status: str, user_name: str = "Sistem"):
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError("Sipariş bulunamadı.")

        old_status = order.order_status

        # Kilitli durum kontrolü: İptal edilmiş veya Tamamlanmış siparişler değiştirilemez
        if old_status in ["İptal", "Tamamlandı"]:
            raise ValueError(f"'{old_status}' durumundaki bir siparişin durumu daha sonra değiştirilemez.")

        # Sipariş Durumunu Güncelle
        order.order_status = new_status

        # İPTAL EDİLME DURUMU SENARYOSU (Para İadesi & Stok Geri Yükleme)
        if new_status == "İptal":
            order.payment_status = "İade Edildi"  # Para İadesi Kaydı (Cirodan Düşer)

            # Siparişteki ürünlerin stoklarını geri iade et
            for item in order.items:
                product = self.db.query(Product).filter(Product.id == item.product_id).first()
                if product:
                    prev_stock = product.stock
                    product.stock += item.quantity  # Stok Geri Eklendi

                    # Stok Hareket Notu/Logu Oluştur
                    movement = StockMovement(
                        product_id=product.id,
                        user_name=user_name,
                        action_type="ARTTIR",
                        quantity=item.quantity,
                        previous_stock=prev_stock,
                        new_stock=product.stock,
                        description=f"{order.order_code} kodlu sipariş iptal edildi. Stok iade alındı."
                    )
                    self.db.add(movement)

        self.db.commit()
        self.db.refresh(order)
        return order