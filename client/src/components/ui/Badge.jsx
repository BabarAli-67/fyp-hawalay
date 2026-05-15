/**
 * dashboard.html — FOUND / LOST image corner badges;
 * user_profle.html — Returned (claimed) + "2 New" style (active).
 */
const FOUND =
  'absolute top-2 right-2 px-2 py-1 bg-primary/90 text-white text-[10px] font-bold rounded-md backdrop-blur-sm';

const LOST =
  'absolute top-2 right-2 px-2 py-1 bg-outline text-white text-[10px] font-bold rounded-md backdrop-blur-sm';

const CLAIMED =
  'bg-primary text-on-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter';

const ACTIVE = 'bg-tertiary-container/20 text-tertiary font-label-sm px-2 py-1 rounded-full';

const VARIANT_CLASS = {
  found: FOUND,
  lost: LOST,
  claimed: CLAIMED,
  active: ACTIVE,
};

export function Badge({ variant = 'found', label, className = '', ...rest }) {
  const cls = `${VARIANT_CLASS[variant]} ${className}`.trim();
  return (
    <span className={cls} {...rest}>
      {label}
    </span>
  );
}
