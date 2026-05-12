import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { setUnauthorizedHandler } from '../services/api';
import { meRequest, type AuthUser } from '../services/auth.service';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'marabu_token';
const USER_KEY = 'marabu_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });
  const [loading, setLoading] = useState(!!token);

  // Enregistre le handler de déconnexion automatique sur 401
  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, []);

  // Au montage avec un token existant, vérifie sa validité
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    meRequest()
      .then(me => setUser({ name: me.name, email: me.email, role: me.role }))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, []);

  function login(t: string, u: AuthUser) {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setToken(t);
    setUser(u);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
