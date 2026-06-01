import { Link, useLocation } from 'react-router-dom';

const NAV =
  'fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe h-20 bg-surface/70 backdrop-blur-xl rounded-t-xl shadow-lg';

/** Tailwind offset matching nav `h-20` (5rem / 80px). */
export const BOTTOM_NAV_OFFSET_CLASS = 'bottom-20';

/** Main outlet clearance when bottom nav is visible (AppLayout). */
export const BOTTOM_NAV_CLEARANCE_CLASS = 'pb-24';

const TAB_BASE =
  'flex flex-col items-center justify-center transition-all duration-200 cursor-pointer px-3 py-1 rounded-xl active:scale-98';

const TAB_ACTIVE = `${TAB_BASE} text-primary font-bold`;

const TAB_INACTIVE = `${TAB_BASE} text-on-surface-variant hover:bg-surface-container-high/50`;

const MESSAGES_BADGE =
  'absolute -top-0.5 -right-0.5 min-h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container text-[10px] font-bold';

/** Main app tab bar — rendered from AppLayout on authenticated tab routes. */
export function BottomNav({ chatUnreadCount = 0 }) {
  const { pathname } = useLocation();
  const homeActive = pathname === '/dashboard';
  const searchActive = pathname === '/matches' || pathname.startsWith('/matches/');
  const chatsActive = pathname === '/chats' || pathname.startsWith('/chat/');
  const profileActive = pathname === '/profile';

  return (
    <nav className={NAV} aria-label="Main navigation">
      <Link
        to="/dashboard"
        className={homeActive ? TAB_ACTIVE : TAB_INACTIVE}
        aria-current={homeActive ? 'page' : undefined}
      >
        <span
          className="material-symbols-outlined"
          style={homeActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          home
        </span>
        <span className="font-label-sm text-label-sm">Home</span>
      </Link>
      <Link
        to="/matches"
        className={searchActive ? TAB_ACTIVE : TAB_INACTIVE}
        aria-current={searchActive ? 'page' : undefined}
      >
        <span
          className="material-symbols-outlined"
          style={searchActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          search
        </span>
        <span className="font-label-sm text-label-sm">Search</span>
      </Link>
      <Link to="/report" className="flex flex-col items-center justify-center relative -mt-8">
        <div className="w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform duration-200">
          <span className="material-symbols-outlined text-white text-[32px]">add</span>
        </div>
        <span className="font-label-sm text-label-sm text-on-surface-variant mt-2">Report</span>
      </Link>
      <Link
        to="/chats"
        className={chatsActive ? TAB_ACTIVE : TAB_INACTIVE}
        aria-current={chatsActive ? 'page' : undefined}
      >
        <span className="relative inline-flex items-center justify-center">
          <span
            className="material-symbols-outlined"
            style={chatsActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            chat
          </span>
          {chatUnreadCount > 0 ? (
            <span className={MESSAGES_BADGE} aria-label={`${chatUnreadCount} unread messages`}>
              {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
            </span>
          ) : null}
        </span>
        <span className="font-label-sm text-label-sm">Messages</span>
      </Link>
      <Link
        to="/profile"
        className={profileActive ? TAB_ACTIVE : TAB_INACTIVE}
        aria-current={profileActive ? 'page' : undefined}
      >
        <span
          className="material-symbols-outlined"
          style={profileActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          person
        </span>
        <span className="font-label-sm text-label-sm">Profile</span>
      </Link>
    </nav>
  );
}

export function shouldShowBottomNav(pathname, user) {
  if (!user) return false;
  return (
    pathname === '/dashboard' ||
    pathname === '/profile' ||
    pathname.startsWith('/notifications') ||
    pathname === '/chats' ||
    pathname.startsWith('/chat/') ||
    pathname.startsWith('/matches') ||
    pathname === '/offline'
  );
}
