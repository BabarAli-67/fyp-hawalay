import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function scrollWindowToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/**
 * Reset window scroll on every client-side route change.
 * SPAs do not scroll to top by default; fixed bottom nav + scrollIntoView
 * elsewhere can leave the document pinned at the bottom of the previous view.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    scrollWindowToTop();

    const frameId = requestAnimationFrame(() => {
      scrollWindowToTop();
    });

    return () => cancelAnimationFrame(frameId);
  }, [pathname]);

  return null;
}

export default ScrollToTop;
