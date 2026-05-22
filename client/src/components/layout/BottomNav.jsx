import { Link, useLocation } from 'react-router-dom';

const NAV =
  'fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe h-20 bg-surface/70 backdrop-blur-xl rounded-t-xl shadow-lg';

const TAB_BASE =
  'flex flex-col items-center justify-center transition-all duration-200 cursor-pointer px-3 py-1 rounded-xl active:scale-98';

const TAB_ACTIVE = `${TAB_BASE} text-primary font-bold`;

const TAB_INACTIVE = `${TAB_BASE} text-on-surface-variant hover:bg-surface-container-high/50`;

/** Main app tab bar — rendered from AppLayout on authenticated tab routes. */
export function BottomNav() {
  const { pathname } = useLocation();
  const homeActive = pathname === '/dashboard';
  const searchActive = pathname === '/matches' || pathname.startsWith('/matches/');
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
      <Link to="/notifications" className={TAB_INACTIVE}>
        <span className="material-symbols-outlined">notifications</span>
        <span className="font-label-sm text-label-sm">Alerts</span>
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
    pathname.startsWith('/matches') ||
    pathname === '/offline'
  );
}
