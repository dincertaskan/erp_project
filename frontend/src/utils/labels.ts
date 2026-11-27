export type UserRole = 'admin' | 'warehouse' | 'customer';
export type OrderStatus = 'pending' | 'preparing' | 'shipped' | 'completed' | 'cancelled';
export type PaymentMethod = 'credit_card' | 'bank_transfer' | 'cash_on_delivery';
export type StockMovementType = 'in' | 'out' | 'order_out' | 'cancel_return';
export type StockStatus = 'sufficient' | 'critical' | 'out_of_stock';

export const roleLabels: Record<UserRole, string> = {
  admin: 'Yönetici',
  warehouse: 'Depo Personeli',
  customer: 'Müşteri',
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: 'Onay Bekliyor',
  preparing: 'Hazırlanıyor',
  shipped: 'Kargolandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  credit_card: 'Kredi Kartı',
  bank_transfer: 'Havale/EFT',
  cash_on_delivery: 'Kapıda Ödeme',
};

export const movementTypeLabels: Record<StockMovementType, string> = {
  in: 'Giriş',
  out: 'Çıkış',
  order_out: 'Sipariş Çıkışı',
  cancel_return: 'İptal İadesi',
};

export const stockStatusLabels: Record<StockStatus, string> = {
  sufficient: 'Yeterli',
  critical: 'Kritik',
  out_of_stock: 'Stokta Yok',
};

/** Arka uçtaki stock_repository tanımlarıyla aynı: stok 0 ise tükendi, 0 < stok < minimum ise kritik. */
export function getStockStatus(stock: number, minStock: number): StockStatus {
  if (stock <= 0) return 'out_of_stock';
  if (stock < minStock) return 'critical';
  return 'sufficient';
}
