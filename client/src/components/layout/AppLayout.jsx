import { Outlet, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useOfflineQueue } from '../../hooks/useOfflineQueue.js';
import { STITCH_TOAST_CLASSNAME } from '../ui/Toast.jsx';
import { OfflineBanner } from '../ui/OfflineBanner.jsx';
import { BottomNav, shouldShowBottomNav } from './BottomNav.jsx';
import { Navbar } from './Navbar.jsx';

/**
 * Authenticated shell: Stitch top navbar, react-router outlet, toast host, offline strip.
 * offline_pwa_experience.html — offline copy for the banner body.
 */
export function AppLayout({ user, unreadCount = 0, onLogout }) {
  const { isOnline } = useOfflineQueue();
  const { pathname } = useLocation();
  const showBottomNav = shouldShowBottomNav(pathname, user);

  return (
    <>
      <Navbar user={user} unreadCount={unreadCount} onLogout={onLogout} />
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
        <p className="flex-1 text-center font-body-md text-body-md text-on-surface-variant">
          You&apos;re currently offline. Your reports are safe and will sync as soon as you&apos;re back.
        </p>
        <div className="w-6 shrink-0" />
      </OfflineBanner>
      <main
        className={`min-h-screen ${isOnline ? 'pt-20' : 'pt-32'} ${showBottomNav ? 'pb-24' : ''}`.trim()}
      >
        <Outlet context={{ user, unreadCount, onLogout }} />
      </main>
      {showBottomNav ? <BottomNav /> : null}
    </>
  );
}
