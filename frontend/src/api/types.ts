import type { UserRole } from '@/utils/labels';

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
