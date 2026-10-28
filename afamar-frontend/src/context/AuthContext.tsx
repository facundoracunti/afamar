import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import http from '@/api/http';
import type { AuthResponse, LoginCredentials, User } from '@/types';
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from '@/utils/safeStorage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = readLocalStorage('auth_token');
    const storedUser = readLocalStorage('auth_user');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        removeLocalStorage('auth_token');
        removeLocalStorage('auth_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const res = await http.post('/auth/login', credentials);
    const data = res.data as unknown as AuthResponse;
    writeLocalStorage('auth_token', data.access_token);
    writeLocalStorage('auth_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    removeLocalStorage('auth_token');
    removeLocalStorage('auth_user');
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, login, logout, isAuthenticated: !!user }),
    [user, loading, login, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
