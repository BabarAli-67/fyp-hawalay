import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge.jsx';
import { ItemImage } from './ItemImage.jsx';
import { formatCardDate } from '../../utils/mapItemForCard.js';

const STATUS_CLASS = {
  active: 'bg-secondary-container text-on-secondary-container',
  claimed: 'bg-surface-variant text-on-surface-variant',
  returned: 'bg-primary-container text-on-primary-container',
  expired: 'bg-tertiary-container/20 text-tertiary',
};

const STATUS_LABEL = {
  active: 'Active',
  claimed: 'Claimed',
  returned: 'Returned',
  expired: 'Expired',
};

/**
 * OLX-style horizontal marketplace card — image left, metadata right, fully clickable.
 * Status badge is display-only (does not change status on tap).
 */
export function HorizontalItemCard({ item, showViewHint = true }) {
  const reportVariant = item.reportType === 'found' ? 'found' : 'lost';
  const reportLabel = item.reportType === 'found' ? 'FOUND' : 'LOST';
  const statusKey = STATUS_LABEL[item.status] ? item.status : 'active';
  const locationName = item.locationName?.trim() || '—';
  const detailPath = `/item/${item._id}`;

  return (
    <div className="group flex w-full max-w-full rounded-xl border border-outline-variant/20 bg-surface shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      <Link
        to={detailPath}
        className="flex min-w-0 flex-1 items-stretch no-underline text-inherit active:scale-[0.995] transition-transform"
      >
        <div className="relative h-28 w-28 shrink-0 bg-surface-container sm:h-32 sm:w-32">
          <ItemImage
            itemId={item._id}
            hasImage={item.hasImage}
            className="h-full w-full object-cover"
            placeholderClassName="flex h-full w-full items-center justify-center"
            loading="lazy"
          />
          <Badge variant={reportVariant} label={reportLabel} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between p-md">
          <div className="min-w-0 space-y-0.5">
            <h3 className="font-h3 text-h3 text-on-surface line-clamp-2 leading-snug">{item.title}</h3>
            <p className="font-caption text-caption text-outline truncate">{item.category || '—'}</p>
            <p className="font-caption text-caption text-on-surface-variant">
              {formatCardDate(item.date)}
            </p>
            <div className="flex min-w-0 items-center gap-xs text-outline">
              <span className="material-symbols-outlined shrink-0 text-[16px]">location_on</span>
              <span className="font-caption text-caption truncate" title={locationName}>
                {locationName}
              </span>
            </div>
            {(item.status === 'returned' || item.status === 'claimed') && item.returnedAt ? (
              <p className="font-caption text-caption text-on-surface-variant">
                Returned on {formatCardDate(item.returnedAt)}
              </p>
            ) : null}
          </div>

          <div className="mt-sm flex items-center justify-between gap-sm pt-1">
            <span
              className={`shrink-0 text-[10px] font-bold uppercase tracking-tighter rounded px-2 py-0.5 pointer-events-none ${STATUS_CLASS[statusKey] ?? STATUS_CLASS.active}`}
            >
              {STATUS_LABEL[statusKey] ?? STATUS_LABEL.active}
            </span>
            {showViewHint ? (
              <span className="flex shrink-0 items-center gap-0.5 font-caption text-primary opacity-80 transition-opacity group-hover:opacity-100">
                View details
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </div>
  );
}
