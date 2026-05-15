/**
 * notification_screen.html — commented empty state block;
 * offline_pwa_experience.html — Retry Connection button.
 */
const WRAP = 'flex flex-col items-center justify-center py-xl text-center';

const ICON = 'material-symbols-outlined text-[64px] text-outline-variant mb-md';

const TITLE = 'font-h2 text-h2 text-on-surface-variant';

const SUBTITLE = 'font-body-md text-body-md text-outline';

const ACTION =
  'mt-lg px-xl py-md bg-primary text-on-primary rounded-full font-h3 text-h3 shadow-sm active:scale-95 transition-all flex items-center gap-2';

export function EmptyState({
  icon = 'notifications_off',
  title,
  subtitle,
  actionLabel,
  onAction,
  className = '',
  ...rest
}) {
  return (
    <div className={`${WRAP} ${className}`.trim()} {...rest}>
      <span className={ICON} data-icon={icon}>
        {icon}
      </span>
      <h3 className={TITLE}>{title}</h3>
      <p className={SUBTITLE}>{subtitle}</p>
      {actionLabel && typeof onAction === 'function' ? (
        <button type="button" className={ACTION} onClick={onAction}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
            refresh
          </span>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
