import type { OrderStatus } from '@/utils/labels';

export interface CustomerListItem {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  address: string | null;
  city: string | null;
  is_active: boolean;
  source: 'app' | 'olist';
  created_at: string;
  has_account: boolean;
  order_count: number;
  /** Yalnızca onaylanmış ve iptal edilmemiş siparişler */
  total_spent: string;
  last_order_at: string | null;
}

export interface CustomerDetail extends CustomerListItem {
  /** Kullanılmamış ve süresi dolmamış davet kodunun son geçerlilik zamanı */
  invite_expires_at: string | null;
  stats: {
    order_count: number;
    revenue_order_count: number;
    total_spent: string;
    average_basket: string;
    last_order_at: string | null;
  };
}

/** Kayıt olan kişinin müşteri kartına bağlanması için tek kullanımlık davet kodu; yalnızca üretilirken döner. */
export interface CustomerInvite {
  code: string;
  expires_at: string;
}

export interface CustomerOrder {
  id: number;
  order_code: string;
  created_at: string;
  item_count: number;
  total_amount: string;
  status: OrderStatus;
}
