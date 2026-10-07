import uuid
from sqlalchemy.orm import Session, joinedload
from app.models.erp import Order, OrderItem, Product, StockMovement
from app.schemas.order_schema import OrderCreate

class OrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all_orders(self):
        """Tüm siparişleri ürün detaylarıyla birlikte en yeniden en eskiye sıralayarak getirir."""
        orders = self.db.query(Order).options(
            joinedload(Order.items).joinedload(OrderItem.product)
        ).order_by(Order.id.desc()).all()

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
                    "total_price": float(item.total_price),
                    "image_url": item.product.image_url if item.product else None,
                    # Frontend'de item.product.image_url ve item.product.name erişimini desteklemek için:
                    "product": {
                        "id": item.product.id if item.product else item.product_id,
                        "name": item.product.name if item.product else "Bilinmeyen Ürün",
                        "image_url": item.product.image_url if item.product else None
                    } if item.product else None
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

    def create_order(self, data: OrderCreate, user_name: str = "Dinçer Taşkan"):
        """Yeni sipariş oluşturur, stok miktarını düşer ve log kaydı oluşturur."""
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

            # Stok Düşürme ve Stok Hareketi Loglama
            prev_stock = product.stock
            product.stock -= item_data.quantity
            
            movement = StockMovement(
                product_id=product.id,
                user_name=user_name,
                action_type="AZALT",
                quantity=item_data.quantity,
                previous_stock=prev_stock,
                new_stock=product.stock,
                description="Yeni sipariş oluşturuldu."
            )
            self.db.add(movement)

            order_items_to_add.append({
                "product_id": product.id,
                "quantity": item_data.quantity,
                "unit_price": product.unit_price,
                "total_price": item_total
            })

        # 2. Ana Sipariş Kaydı (Varsayılan durum: Onay Bekliyor)
        unique_code = f"#ORD-{uuid.uuid4().hex[:6].upper()}"
        new_order = Order(
            order_code=unique_code,
            customer_name=data.customer_name or "Misafir Müşteri",
            total_price=grand_total,
            payment_method=data.payment_method,
            payment_status="Ödendi",
            order_status="Onay Bekliyor",
            note=data.note
        )
        self.db.add(new_order)
        self.db.commit()
        self.db.refresh(new_order)

        # 3. Sipariş Kalemleri Kaydı
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
        return self.get_all_orders()[0]

    def update_order_status(self, order_id: int, new_status: str, user_name: str = "Dinçer Taşkan"):
        """
        Sipariş durumunu günceller.
        'İptal' veya 'Tamamlandı' olan siparişlerin durumunun tekrar değiştirilmesini engeller.
        'İptal' edildiğinde stoku otomatik iade eder ve ödeme durumunu 'İade Edildi' yapar.
        """
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError("Sipariş bulunamadı.")

        old_status = order.order_status

        # Kilit Durumu Kontrolü (Tamamlanan veya İptal edilen siparişler kilitlenir)
        if old_status in ["İptal", "Tamamlandı"]:
            raise ValueError(f"'{old_status}' durumundaki bir siparişin durumu daha sonra değiştirilemez.")

        order.order_status = new_status

        # İPTAL SENARYOSU (Para İadesi & Stok Geri Yükleme)
        if new_status == "İptal":
            order.payment_status = "İade Edildi"

            for item in order.items:
                product = self.db.query(Product).filter(Product.id == item.product_id).first()
                if product:
                    prev_stock = product.stock
                    product.stock += item.quantity

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