import { jwtDecode } from 'jwt-decode';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import axiosInstance from '../api/axiosInstance.js';
import { connectMatchSocket, disconnectMatchSocket } from '../socket/matchSocket.js';
import { clearChatCache } from '../utils/chatCache.js';

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';
const UNREAD_FETCH_DEBOUNCE_MS = 2000;

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
  const [socket, setSocket] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(() => Boolean(initial.token));
  const [unreadCount, setUnreadCount] = useState(0);

  const lastUnreadFetchAtRef = useRef(0);
  const unreadFetchTimerRef = useRef(null);

  const logout = useCallback(() => {
    disconnectMatchSocket();
    clearChatCache();
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setToken(null);
    setUser(null);
    setUnreadCount(0);
    if (unreadFetchTimerRef.current) {
      clearTimeout(unreadFetchTimerRef.current);
      unreadFetchTimerRef.current = null;
    }
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

  const fetchUnreadCount = useCallback(() => {
    if (!token) {
      setUnreadCount(0);
      return;
    }

    const runFetch = () => {
      lastUnreadFetchAtRef.current = Date.now();
      unreadFetchTimerRef.current = null;

      axiosInstance
        .get('/api/notifications/unread-count')
        .then((res) => setUnreadCount(res.data?.count ?? 0))
        .catch(() => setUnreadCount(0));
    };

    const elapsed = Date.now() - lastUnreadFetchAtRef.current;
    if (elapsed >= UNREAD_FETCH_DEBOUNCE_MS) {
      if (unreadFetchTimerRef.current) {
        clearTimeout(unreadFetchTimerRef.current);
        unreadFetchTimerRef.current = null;
      }
      runFetch();
      return;
    }

    if (!unreadFetchTimerRef.current) {
      unreadFetchTimerRef.current = setTimeout(runFetch, UNREAD_FETCH_DEBOUNCE_MS - elapsed);
    }
  }, [token]);

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

  useEffect(() => {
    if (token) {
      setSocket(connectMatchSocket(token));
    } else {
      disconnectMatchSocket();
      setSocket(null);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      return;
    }
    fetchUnreadCount();
  }, [token, fetchUnreadCount]);

  useEffect(() => {
    if (!token) return undefined;

    function handleMatchFound(event) {
      const payload = event.detail ?? {};
      const title = payload.title ? String(payload.title).trim() : '';
      toast.success(
        title
          ? `New match found for your item — ${title}!`
          : 'New match found for your item!',
      );
      fetchUnreadCount();
      window.dispatchEvent(new CustomEvent('hawalay:refresh-matches', { detail: payload }));
    }

    function handleUnreadRefetch() {
      fetchUnreadCount();
    }

    window.addEventListener('hawalay:match-found', handleMatchFound);
    window.addEventListener('hawalay:unread-refetch', handleUnreadRefetch);
    return () => {
      window.removeEventListener('hawalay:match-found', handleMatchFound);
      window.removeEventListener('hawalay:unread-refetch', handleUnreadRefetch);
    };
  }, [token, fetchUnreadCount]);

  useEffect(
    () => () => {
      if (unreadFetchTimerRef.current) {
        clearTimeout(unreadFetchTimerRef.current);
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      token,
      socket,
      isAuthLoading,
      unreadCount,
      fetchUnreadCount,
      login,
      logout,
      updateUser,
    }),
    [user, token, socket, isAuthLoading, unreadCount, fetchUnreadCount, login, logout, updateUser],
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
