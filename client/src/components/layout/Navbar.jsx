import { Link, useLocation } from 'react-router-dom';

/**
 * dashboard.html — Top App Bar
 * signUp.html — guest brand row (shield + EthicalFinder)
 * notification_screen.html — avatar tile, settings-style icon buttons
 * login.html — footer / forgot link styling for auth links
 * notification_screen.html bottom nav — active Alerts (filled bell + font-bold)
 */

const HEADER =
  'fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface/70 backdrop-blur-lg shadow-sm';

const GUEST_BRAND_WRAP = 'flex items-center gap-base';

const GUEST_SHIELD = 'material-symbols-outlined text-primary';

const BRAND_TITLE = 'font-h2 text-h2 font-bold text-primary';

const AUTH_LEFT_WRAP = 'flex items-center gap-3 flex-1 min-w-0';

const AVATAR_WRAP =
  'w-10 h-10 shrink-0 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container overflow-hidden';

const AVATAR_IMG = 'w-full h-full object-cover';

const USER_NAME = 'font-body-md text-on-surface-variant truncate flex-1 min-w-0';

const ICON_BTN =
  'w-10 h-10 flex items-center justify-center text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95 duration-200';

const NOTIFICATIONS_NAV_ACTIVE =
  'relative w-10 h-10 flex items-center justify-center text-primary font-bold hover:opacity-80 transition-opacity active:scale-95 duration-200';

const NOTIFICATIONS_NAV_INACTIVE =
  'relative w-10 h-10 flex items-center justify-center text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95 duration-200';

const NOTIFICATIONS_BADGE =
  'absolute -top-0.5 -right-0.5 min-h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container text-[10px] font-bold';

const NAV_LINK_INACTIVE = 'font-label-sm text-primary hover:opacity-80 transition-soft';

const NAV_LINK_ACTIVE = 'font-label-sm text-primary font-bold';

export function Navbar({ user, unreadCount = 0, onLogout }) {
  const location = useLocation();
  const loginActive = location.pathname === '/login';
  const registerActive = location.pathname === '/register';
  const notificationsActive = location.pathname.startsWith('/notifications');

  return (
    <header className={HEADER}>
      {user == null ? (
        <>
          <Link to="/login" className={GUEST_BRAND_WRAP}>
            <span className={GUEST_SHIELD} data-icon="shield">
              shield
            </span>
            <h1 className={BRAND_TITLE}>EthicalFinder</h1>
          </Link>
          <div className="flex items-center gap-md">
            <Link
              to="/login"
              className={loginActive ? NAV_LINK_ACTIVE : NAV_LINK_INACTIVE}
              aria-current={loginActive ? 'page' : undefined}
            >
              Login
            </Link>
            <Link
              to="/register"
              className={registerActive ? NAV_LINK_ACTIVE : NAV_LINK_INACTIVE}
              aria-current={registerActive ? 'page' : undefined}
            >
              Register
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className={AUTH_LEFT_WRAP}>
            <div className={AVATAR_WRAP}>
              <img alt={user.name} className={AVATAR_IMG} src={user.avatarUrl} />
            </div>
            <span className={USER_NAME}>{user.name}</span>
            <Link to="/dashboard" className="shrink-0">
              <h1 className={BRAND_TITLE}>EthicalFinder</h1>
            </Link>
          </div>
          <div className="flex items-center gap-md">
            <Link
              to="/notifications"
              className={notificationsActive ? NOTIFICATIONS_NAV_ACTIVE : NOTIFICATIONS_NAV_INACTIVE}
              aria-current={notificationsActive ? 'page' : undefined}
            >
              <span className="relative inline-flex items-center justify-center">
                <span
                  className="material-symbols-outlined"
                  data-icon="notifications"
                  style={notificationsActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  notifications
                </span>
                {unreadCount > 0 ? (
                  <span className={NOTIFICATIONS_BADGE} aria-label={`${unreadCount} unread`}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </span>
            </Link>
            <button type="button" className={ICON_BTN} onClick={onLogout} aria-label="Log out">
              <span className="material-symbols-outlined" data-icon="logout">
                logout
              </span>
            </button>
          </div>
        </>
      )}
    </header>
  );
}
