import { createContext } from 'react';
import type { CurrentUser } from '@/api/types';

export const ME_QUERY_KEY = ['auth', 'me'] as const;

export interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  /** Oturum süresi dolduğu için çıkış yapıldıysa true (giriş ekranında bilgi göstermek için) */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
