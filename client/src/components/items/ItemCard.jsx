import { Badge } from '../ui/Badge.jsx';

/**
 * dashboard.html — Recent Activity card shell + image area + footer row.
 * user_profle.html — status chips (Searching / Matched tones).
 */

const CARD =
  'w-full bg-surface rounded-xl border border-outline-variant/20 shadow-sm overflow-hidden flex flex-col';

const MEDIA = 'h-32 w-full relative bg-surface-container';

const PLACEHOLDER_WRAP = 'absolute inset-0 flex items-center justify-center';

const BODY = 'p-md space-y-xs';

const TITLE = 'font-h3 text-h3 text-on-surface';

const META = 'font-caption text-caption text-outline';

const LOC_ROW = 'flex items-center gap-xs text-outline';

const FOOTER_ROW = 'flex items-center justify-between pt-2';

const STATUS_ACTIVE =
  'bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter cursor-pointer active:scale-95 transition-transform';

const STATUS_CLAIMED =
  'bg-surface-variant text-on-surface-variant text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter cursor-pointer active:scale-95 transition-transform';

const STATUS_EXPIRED =
  'bg-tertiary-container/20 text-tertiary font-label-sm px-2 py-1 rounded-full cursor-pointer active:scale-95 transition-transform';

const STATUS_CLASS = {
  active: STATUS_ACTIVE,
  claimed: STATUS_CLAIMED,
  expired: STATUS_EXPIRED,
};

const STATUS_LABEL = {
  active: 'ACTIVE',
  claimed: 'CLAIMED',
  expired: 'EXPIRED',
};

const STATUS_CYCLE = ['active', 'claimed', 'expired'];

function nextStatus(current) {
  const i = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
}

export function ItemCard({ item, onStatusChange }) {
  const reportVariant = item.reportType === 'found' ? 'found' : 'lost';
  const reportLabel = item.reportType === 'found' ? 'FOUND' : 'LOST';
  const statusKey = STATUS_CYCLE.includes(item.status) ? item.status : 'active';
  const statusClass = STATUS_CLASS[statusKey];
  const statusLabel = STATUS_LABEL[statusKey];

  return (
    <article className={CARD}>
      <div className={MEDIA}>
        {item.imageUrl ? (
          <img alt="" className="w-full h-full object-cover" src={item.imageUrl} />
        ) : (
          <div className={PLACEHOLDER_WRAP} aria-hidden>
            <span className="material-symbols-outlined text-[48px] text-outline-variant">image</span>
          </div>
        )}
        <Badge variant={reportVariant} label={reportLabel} />
      </div>
      <div className={BODY}>
        <h4 className={TITLE}>{item.title}</h4>
        <p className={META}>{item.category}</p>
        <p className={META}>{item.date}</p>
        <div className={LOC_ROW}>
          <span className="material-symbols-outlined text-[16px]">location_on</span>
          <span className="text-caption">{item.locationName}</span>
        </div>
        <div className={FOOTER_ROW}>
          <button
            type="button"
            className={statusClass}
            onClick={() => onStatusChange(item, nextStatus(item.status))}
          >
            {statusLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
