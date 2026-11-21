import type { StockMovement } from './types';
import type { OrderStatus, PaymentMethod } from '@/utils/labels';

export type OrderAction = 'approve' | 'ship' | 'complete' | 'cancel';

export interface Shortage {
  product_id: number;
  sku: string;
  name: string;
  requested: number;
  available: number;
}

export interface OrderListItem {
  id: number;
  order_code: string;
  created_at: string;
  status: OrderStatus;
  customer: { id: number; full_name: string };
  item_count: number;
  total_amount: string;
  payment_method: PaymentMethod;
  source: 'app' | 'olist';
  allowed_actions: OrderAction[];
}

export interface OrderPage {
  items: OrderListItem[];
  total: number;
  page: number;
  page_size: number;
  counts_by_status: Partial<Record<OrderStatus, number>>;
}

export interface OrderItem {
  id: number;
  product: { id: number; sku: string; name: string; image_url: string | null; stock: number };
  quantity: number;
  unit_price: string;
  line_total: string;
}

export interface StatusHistory {
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_at: string;
  changed_by: { id: number; full_name: string } | null;
}

export interface OrderDetail extends OrderListItem {
  customer: {
    id: number;
    full_name: string;
    email: string;
    phone: string | null;
    company_name: string | null;
    address: string | null;
    city: string | null;
  };
  shipping_address: string | null;
  note: string | null;
  created_by: { id: number; full_name: string } | null;
  approved_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  items: OrderItem[];
  history: StatusHistory[];
  movements: (StockMovement & { product: { id: number; sku: string; name: string } })[];
  shortages: Shortage[];
}

export type { CustomerListItem } from './customers';

/** Eylem başarıyla yapıldığında gösterilen mesaj */
export const orderActionDoneMessages: Record<OrderAction, string> = {
  approve: 'Sipariş onaylandı, stok düşüldü.',
  ship: 'Sipariş kargoya verildi.',
  complete: 'Sipariş teslim edildi olarak işaretlendi.',
  cancel: 'Sipariş iptal edildi.',
};

export const orderActionLabels: Record<OrderAction, string> = {
  approve: 'Onayla',
  ship: 'Kargoya Ver',
  complete: 'Teslim Edildi',
  cancel: 'İptal Et',
};
