import type { StockMovementType, StockStatus, UserRole } from '@/utils/labels';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface CustomerProfile {
  id: number;
  phone: string | null;
  company_name: string | null;
  address: string | null;
  city: string | null;
}

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface CurrentUser extends User {
  customer: CustomerProfile | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  user: CurrentUser;
}

export interface CategoryRef {
  id: number;
  name: string;
  color: string;
}

export interface Category extends CategoryRef {
  is_active: boolean;
  created_at: string;
  product_count: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category: CategoryRef;
  sale_price: string;
  /** Yalnızca yöneticiye gönderilir */
  cost_price?: string;
  stock: number;
  min_stock: number;
  stock_status: StockStatus;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_movement_at?: string | null;
}

export interface ProductDetail extends Product {
  stats: { sold_last_30_days: number; last_movement_at: string | null };
}

export interface StockMovement {
  id: number;
  movement_type: StockMovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  description: string | null;
  created_at: string;
  user: { id: number; full_name: string };
  order: { id: number; order_code: string } | null;
}

export interface StockMovementListItem extends StockMovement {
  product: { id: number; sku: string; name: string };
}

export interface StockMovementResult {
  movement: StockMovement;
  product: { id: number; stock: number; stock_status: StockStatus };
}

export interface CriticalProduct extends Product {
  shortage: number;
  sold_last_30_days: number;
}

export interface StockSummary {
  active_products: number;
  critical_count: number;
  today_movements: number;
}
