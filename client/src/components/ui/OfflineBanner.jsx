/**
 * dashboard.html — Top App Bar shell (fixed strip).
 * `belowNavbar`: use `top-16` so the bar sits under the fixed app navbar (h-16).
 */
const BANNER_BASE =
  'fixed left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface/70 backdrop-blur-lg shadow-sm';

export function OfflineBanner({
  isOnline,
  belowNavbar = false,
  children,
  className = '',
  ...rest
}) {
  if (isOnline) return null;

  const top = belowNavbar ? 'top-16' : 'top-0';
  const composed = `${BANNER_BASE} ${top} ${className}`.trim();

  return (
    <div className={composed} role="status" {...rest}>
      {children}
    </div>
  );
}
