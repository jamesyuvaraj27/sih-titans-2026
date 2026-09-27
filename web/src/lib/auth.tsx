import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, post, setToken, type Me } from './api.js';
import { normalizeRole, type CanonicalRole } from './format.js';

interface AuthValue {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (...roles: (Me['role'] | CanonicalRole | string)[]) => boolean;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api<Me>('/auth/me')
      .then(setMe)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await post<{ token: string }>('/auth/login', { email, password });
    setToken(res.token);
    setMe(await api<Me>('/auth/me'));
  }, []);

  const logout = useCallback(() => { setToken(null); setMe(null); }, []);

  const value = useMemo<AuthValue>(() => ({
    me, loading, login, logout,
    can: (...roles) => {
      if (!me) return false;
      const myNorm = normalizeRole(me.role);
      return roles.some((r) => normalizeRole(r) === myNorm || r === me.role);
    },
  }), [me, loading, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
