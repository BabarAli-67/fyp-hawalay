import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { PrivateRoute } from './components/routing/PrivateRoute.jsx';
import { SplashScreen } from './components/ui/splash-screen.jsx';
import { useAuth } from './context/AuthContext.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ReportPage from './pages/ReportPage.jsx';
import BrowseFeedPage from './pages/BrowseFeedPage.jsx';
import MatchResultsPage from './pages/MatchResultsPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ItemDetailsPage from './pages/ItemDetailsPage.jsx';
import OfflineExperiencePage from './pages/OfflineExperiencePage.jsx';
import axiosInstance from './api/axiosInstance.js';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';

function AppShell() {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    axiosInstance
      .get('/api/notifications/unread-count')
      .then((res) => setUnreadCount(res.data?.count ?? 0))
      .catch(() => setUnreadCount(0));
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return (
    <AppLayout user={user} unreadCount={unreadCount} onLogout={logout} />
  );
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setShowSplash(false), 2200);
    return () => window.clearTimeout(id);
  }, []);

  const appRoutes = (
    <>
      <AnimatePresence>{showSplash ? <SplashScreen key="splash" /> : null}</AnimatePresence>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<HomeRedirect />} />
          <Route element={<PrivateRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/matches" element={<BrowseFeedPage />} />
            <Route path="/matches/ai" element={<MatchResultsPage />} />
            <Route path="/chat" element={<Navigate to="/chat/m1" replace />} />
            <Route path="/chat/:id" element={<ChatPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/item/:id" element={<ItemDetailsPage />} />
            <Route path="/offline" element={<OfflineExperiencePage />} />
          </Route>
        </Route>
      </Routes>
    </>
  );

  if (GOOGLE_CLIENT_ID) {
    return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{appRoutes}</GoogleOAuthProvider>;
  }

  return appRoutes;
}
