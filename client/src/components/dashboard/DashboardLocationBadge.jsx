import { useDashboardLocation } from '../../hooks/useDashboardLocation.js';

export function DashboardLocationBadge() {
  const { label, status } = useDashboardLocation();

  if (status === 'loading' && !label) {
    return (
      <span className="inline-flex items-center gap-1 font-caption text-caption text-outline">
        <span className="material-symbols-outlined text-[14px]" aria-hidden>
          location_on
        </span>
        Locating…
      </span>
    );
  }

  if (!label) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 max-w-full font-caption text-caption text-on-surface-variant bg-surface-container px-sm py-0.5 rounded-full truncate">
      <span className="material-symbols-outlined text-[14px] text-primary shrink-0" aria-hidden>
        location_on
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}
