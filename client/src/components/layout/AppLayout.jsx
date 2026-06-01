import { Link, Outlet, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useOfflineQueue } from '../../hooks/useOfflineQueue.js';
import { STITCH_TOAST_CLASSNAME } from '../ui/Toast.jsx';
import { OfflineBanner } from '../ui/OfflineBanner.jsx';
import { BottomNav, BOTTOM_NAV_CLEARANCE_CLASS, shouldShowBottomNav } from './BottomNav.jsx';
import { Navbar } from './Navbar.jsx';
import { ScrollToTop } from '../routing/ScrollToTop.jsx';
import { InstallAppButton } from '../pwa/InstallAppButton.jsx';
import { InstallInstructionsModal } from '../pwa/InstallInstructionsModal.jsx';

/**
 * Authenticated shell: Stitch top navbar, react-router outlet, toast host, offline strip.
 * offline_pwa_experience.html — offline copy for the banner body.
 */
export function AppLayout({ user, unreadCount = 0, chatUnreadCount = 0, onLogout }) {
  const { isOnline } = useOfflineQueue();
  const { pathname } = useLocation();
  const showBottomNav = shouldShowBottomNav(pathname, user);

  return (
    <>
      <ScrollToTop />
      <InstallInstructionsModal />
      <Navbar user={user} unreadCount={unreadCount} chatUnreadCount={chatUnreadCount} onLogout={onLogout} />
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable={false}
        limit={3}
        toastClassName={STITCH_TOAST_CLASSNAME}
        bodyClassName="font-body-md p-0 m-0"
      />
      <OfflineBanner isOnline={isOnline} belowNavbar>
        <div className="w-6 shrink-0" />
        <Link
          to="/offline"
          className="flex-1 text-center font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors"
        >
          You&apos;re currently offline. Your reports are safe and will sync as soon as you&apos;re back.
        </Link>
        <Link
          to="/offline"
          className="w-6 shrink-0 flex items-center justify-center text-primary"
          aria-label="Offline sync details"
        >
          <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
        </Link>
      </OfflineBanner>
      <main
        className={`min-h-screen ${isOnline ? 'pt-20' : 'pt-32'} ${showBottomNav ? BOTTOM_NAV_CLEARANCE_CLASS : ''}`.trim()}
      >
        <Outlet context={{ user, unreadCount, onLogout }} />
      </main>
      {showBottomNav ? <BottomNav chatUnreadCount={chatUnreadCount} /> : null}
    </>
  );
}
