import { jwtDecode } from 'jwt-decode';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axiosInstance from '../api/axiosInstance.js';

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

function readStoredAuth() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const rawUser = localStorage.getItem(AUTH_USER_KEY);
  let user = null;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser);
    } catch {
      user = null;
    }
  }
  if (!token || !user) {
    if (token || rawUser) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
    return { token: null, user: null };
  }
  return { token, user };
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const initial = readStoredAuth();
  const [user, setUser] = useState(initial.user);
  const [token, setToken] = useState(initial.token);
  const [isAuthLoading, setIsAuthLoading] = useState(() => Boolean(initial.token));

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback((newToken, userData) => {
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    setIsAuthLoading(false);
  }, []);

  const updateUser = useCallback((userData) => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
    setUser(userData);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!stored) {
      setIsAuthLoading(false);
      return;
    }

    let decoded;
    try {
      decoded = jwtDecode(stored);
    } catch {
      logout();
      setIsAuthLoading(false);
      return;
    }

    if (typeof decoded.exp !== 'number' || decoded.exp * 1000 <= Date.now()) {
      logout();
      setIsAuthLoading(false);
      return;
    }

    setIsAuthLoading(true);
    axiosInstance
      .get('/api/auth/me')
      .then((res) => {
        setToken(stored);
        setUser(res.data);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.data));
      })
      .catch(() => {
        logout();
      })
      .finally(() => {
        setIsAuthLoading(false);
      });
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthLoading,
      login,
      logout,
      updateUser,
    }),
    [user, token, isAuthLoading, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx == null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
