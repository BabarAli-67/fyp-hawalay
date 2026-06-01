import { Link, useLocation } from 'react-router-dom';
import { Logo } from '../Logo.jsx';
import { UserAvatar } from '../UserAvatar.jsx';
import { InstallAppButton } from '../pwa/InstallAppButton.jsx';

/**
 * dashboard.html — Top App Bar
 * signUp.html — guest brand row (logo + Hawalay)
 * notification_screen.html — avatar tile, settings-style icon buttons
 * login.html — footer / forgot link styling for auth links
 * notification_screen.html bottom nav — active Alerts (filled bell + font-bold)
 */

const HEADER =
  'fixed top-0 left-0 w-full z-50 flex min-w-0 items-center justify-between gap-2 sm:gap-4 px-margin-mobile h-16 bg-surface/70 backdrop-blur-lg shadow-sm';

const GUEST_BRAND_WRAP =
  'flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-base';

const BRAND_LINK = 'flex min-w-0 items-center gap-2 overflow-hidden sm:gap-2';

const BRAND_TITLE =
  'min-w-0 truncate font-h2 text-h2 font-bold text-primary max-sm:text-xl';

const AUTH_LEFT_WRAP = 'flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3';

const USER_NAME =
  'hidden min-w-0 flex-1 truncate font-body-md text-body-md text-on-surface-variant sm:block';

const ACTIONS_WRAP = 'flex shrink-0 items-center gap-0.5 sm:gap-md';

const ICON_BTN =
  'flex h-9 w-9 shrink-0 items-center justify-center text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95 duration-200 sm:h-10 sm:w-10';

const NOTIFICATIONS_NAV_ACTIVE =
  'relative flex h-9 w-9 shrink-0 items-center justify-center text-primary font-bold hover:opacity-80 transition-opacity active:scale-95 duration-200 sm:h-10 sm:w-10';

const NOTIFICATIONS_NAV_INACTIVE =
  'relative flex h-9 w-9 shrink-0 items-center justify-center text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95 duration-200 sm:h-10 sm:w-10';

const NOTIFICATIONS_BADGE =
  'absolute -top-0.5 -right-0.5 min-h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container text-[10px] font-bold';

const NAV_LINK_INACTIVE = 'font-label-sm text-primary hover:opacity-80 transition-soft';

const NAV_LINK_ACTIVE = 'font-label-sm text-primary font-bold';

export function Navbar({ user, unreadCount = 0, chatUnreadCount = 0, onLogout }) {
  const location = useLocation();
  const loginActive = location.pathname === '/login';
  const registerActive = location.pathname === '/register';
  const notificationsActive = location.pathname.startsWith('/notifications');
  const chatsActive =
    location.pathname === '/chats' || location.pathname.startsWith('/chat/');

  return (
    <header className={HEADER}>
      {user == null ? (
        <>
          <Link to="/login" className={GUEST_BRAND_WRAP}>
            <Logo size="sm" className="h-8 w-8 shrink-0 sm:h-10 sm:w-10" />
            <h1 className={BRAND_TITLE}>Hawalay</h1>
          </Link>
          <div className={ACTIONS_WRAP}>
            <InstallAppButton className="!h-9 !w-9 sm:!h-10 sm:!w-10" />
            <Link
              to="/login"
              className={`shrink-0 px-1 sm:px-0 ${loginActive ? NAV_LINK_ACTIVE : NAV_LINK_INACTIVE}`}
              aria-current={loginActive ? 'page' : undefined}
            >
              Login
            </Link>
            <Link
              to="/register"
              className={`shrink-0 px-1 sm:px-0 ${registerActive ? NAV_LINK_ACTIVE : NAV_LINK_INACTIVE}`}
              aria-current={registerActive ? 'page' : undefined}
            >
              Register
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className={AUTH_LEFT_WRAP}>
            <UserAvatar user={user} size="sm" className="shrink-0" />
            <span className={USER_NAME}>{user.name}</span>
            <Link to="/dashboard" className={BRAND_LINK}>
              <Logo size="sm" className="h-8 w-8 shrink-0 sm:h-10 sm:w-10" />
              <h1 className={BRAND_TITLE}>Hawalay</h1>
            </Link>
          </div>
          <div className={ACTIONS_WRAP}>
            <InstallAppButton className="!h-9 !w-9 sm:!h-10 sm:!w-10" />
            <Link
              to="/chats"
              className={chatsActive ? NOTIFICATIONS_NAV_ACTIVE : NOTIFICATIONS_NAV_INACTIVE}
              aria-current={chatsActive ? 'page' : undefined}
              aria-label="Messages"
            >
              <span className="relative inline-flex items-center justify-center">
                <span
                  className="material-symbols-outlined"
                  data-icon="chat"
                  style={chatsActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  chat
                </span>
                {chatUnreadCount > 0 ? (
                  <span className={NOTIFICATIONS_BADGE} aria-label={`${chatUnreadCount} unread messages`}>
                    {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                  </span>
                ) : null}
              </span>
            </Link>
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
