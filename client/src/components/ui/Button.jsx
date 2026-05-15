import { Spinner } from './Spinner.jsx';

/**
 * login.html — primary submit; signUp.html — primary lg + secondary outline;
 * report_lost_item.html — Back (secondary outline); danger uses same shell as login primary with error tokens.
 */
const PRIMARY_MD =
  'bg-primary text-on-primary h-12 rounded-lg font-label-sm shadow-md active:scale-95 transition-soft flex items-center justify-center gap-xs';

const PRIMARY_LG =
  'h-14 bg-primary text-on-primary font-h3 text-h3 rounded-xl shadow-md active:scale-[0.98] transition-all duration-200 hover:opacity-90 flex items-center justify-center gap-xs';

const SECONDARY_MD =
  'bg-surface-container-lowest border border-outline-variant text-on-surface h-12 rounded-lg font-label-sm shadow-sm active:scale-95 transition-soft flex items-center justify-center gap-md';

const SECONDARY_LG =
  'h-14 border border-outline text-on-surface-variant font-label-sm text-label-sm rounded-xl flex items-center justify-center gap-md hover:bg-surface-container-high/50 active:scale-[0.98] transition-all duration-200';

const DANGER_MD =
  'bg-error text-on-error h-12 rounded-lg font-label-sm shadow-md active:scale-95 transition-soft flex items-center justify-center gap-xs';

const DANGER_LG =
  'h-14 bg-error text-on-error font-h3 text-h3 rounded-xl shadow-md active:scale-[0.98] transition-all duration-200 hover:opacity-90 flex items-center justify-center gap-xs';

function variantSizeClasses(variant, size) {
  if (variant === 'primary') return size === 'lg' ? PRIMARY_LG : PRIMARY_MD;
  if (variant === 'secondary') return size === 'lg' ? SECONDARY_LG : SECONDARY_MD;
  return size === 'lg' ? DANGER_LG : DANGER_MD;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  onClick,
  disabled = false,
  loading = false,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const widthClass = fullWidth ? 'w-full' : '';
  const base = `${widthClass} ${variantSizeClasses(variant, size)}`.trim();
  const composed = `${base} ${className}`.trim();

  return (
    <button
      type={type}
      className={composed}
      onClick={onClick}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner variant="inline" />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
