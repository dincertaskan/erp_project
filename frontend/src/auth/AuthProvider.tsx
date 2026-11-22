import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AUTH_EXPIRED_EVENT, api, tokenStorage } from '@/api/client';
import type { CurrentUser, TokenResponse } from '@/api/types';
import { cartStore } from '@/cart/cartStore';
import { AuthContext, ME_QUERY_KEY, type AuthContextValue } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => tokenStorage.get());
  const [sessionExpired, setSessionExpired] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => (await api.get<CurrentUser>('/auth/me')).data,
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    const onExpired = () => {
      setSessionExpired(true);
      clearSession();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<TokenResponse>('/auth/login', { email, password });
      tokenStorage.set(data.access_token);
      queryClient.setQueryData(ME_QUERY_KEY, data.user);
      setSessionExpired(false);
      setSignedOut(false);
      setToken(data.access_token);
      return data.user;
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    setSessionExpired(false);
    setSignedOut(true);
    cartStore.clearAll();
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: token ? (meQuery.data ?? null) : null,
      isLoading: Boolean(token) && meQuery.isPending,
      sessionExpired,
      signedOut,
      login,
      logout,
    }),
    [token, meQuery.data, meQuery.isPending, sessionExpired, signedOut, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
