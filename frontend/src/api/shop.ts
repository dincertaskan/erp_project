import type { CategoryRef, Page } from './types';
import type { OrderStatus, PaymentMethod } from '@/utils/labels';

export type Availability = 'in_stock' | 'low_stock' | 'out_of_stock';
export type CatalogSort = 'recommended' | 'price_asc' | 'price_desc' | 'newest' | 'name';
export type StatusGroup = 'active' | 'completed' | 'cancelled';

export interface CatalogProduct {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category: CategoryRef;
  sale_price: string;
  image_url: string | null;
  availability: Availability;
  available_qty: number;
}

export interface CatalogProductDetail extends CatalogProduct {
  related: CatalogProduct[];
}

export interface CatalogPage extends Page<CatalogProduct> {
  min_price: string | null;
  max_price: string | null;
}

export interface CatalogCategory extends CategoryRef {
  product_count: number;
}

export type CartIssueType = 'not_available' | 'price_changed' | 'insufficient_stock';

export interface CartIssue {
  product_id: number;
  issue: CartIssueType;
  message: string;
  old_price: string | null;
  new_price: string | null;
  available_qty: number | null;
}

export interface CartValidation {
  products: CatalogProduct[];
  issues: CartIssue[];
}

export interface MyOrderItem {
  product_id: number;
  sku: string;
  name: string;
  image_url: string | null;
  quantity: number;
  unit_price: string;
  line_total: string;
}

export interface MyOrderSummary {
  id: number;
  order_code: string;
  created_at: string;
  status: OrderStatus;
  total_amount: string;
  item_count: number;
  preview: MyOrderItem[];
  can_cancel: boolean;
}

export interface MyOrderDetail extends MyOrderSummary {
  items: MyOrderItem[];
  payment_method: PaymentMethod;
  shipping_address: string | null;
  note: string | null;
  timeline: { status: OrderStatus; at: string }[];
}

export const availabilityText = (product: Pick<CatalogProduct, 'availability' | 'available_qty'>) =>
  product.availability === 'out_of_stock'
    ? 'Stokta Yok'
    : product.availability === 'low_stock'
      ? `Son ${product.available_qty} ürün`
      : 'Stokta';

// Beyaz kart zemininde metin olarak AA kontrastında.
export const availabilityColor: Record<Availability, string> = {
  in_stock: '#047857',
  low_stock: '#B45309',
  out_of_stock: '#64748B',
};
