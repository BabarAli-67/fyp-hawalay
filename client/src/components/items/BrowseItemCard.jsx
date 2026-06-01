import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge.jsx';
import { ItemImage } from './ItemImage.jsx';

const STATUS_CLASS = {
  active: 'bg-secondary-container text-on-secondary-container',
  claimed: 'bg-surface-variant text-on-surface-variant',
  expired: 'bg-tertiary-container/20 text-tertiary',
};

const STATUS_LABEL = {
  active: 'Active',
  claimed: 'Claimed',
  expired: 'Expired',
};

/** Read-only community feed card — links to item details. */
export function BrowseItemCard({ item }) {
  const reportVariant = item.reportType === 'found' ? 'found' : 'lost';
  const reportLabel = item.reportType === 'found' ? 'FOUND' : 'LOST';
  const statusKey = ['active', 'claimed', 'expired'].includes(item.status) ? item.status : 'active';

  return (
    <Link
      to={`/item/${item._id}`}
      className="block w-full bg-surface rounded-xl border border-outline-variant/20 shadow-sm overflow-hidden active:scale-[0.99] transition-transform"
    >
      <div className="h-36 w-full relative bg-surface-container">
        <ItemImage
          itemId={item._id}
          hasImage={item.hasImage}
          loading="lazy"
        />
        <Badge variant={reportVariant} label={reportLabel} />
      </div>
      <div className="p-md space-y-xs">
        <h3 className="font-h3 text-h3 text-on-surface line-clamp-2">{item.title}</h3>
        <p className="font-caption text-caption text-outline">{item.category}</p>
        <div className="flex items-center gap-xs text-outline">
          <span className="material-symbols-outlined text-[16px]">location_on</span>
          <span className="font-caption text-caption truncate">{item.locationName || '—'}</span>
        </div>
        <div className="flex items-center justify-between pt-1 gap-sm">
          <span className="font-caption text-on-surface-variant">{item.date || '—'}</span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter shrink-0 ${STATUS_CLASS[statusKey]}`}
          >
            {STATUS_LABEL[statusKey]}
          </span>
        </div>
      </div>
    </Link>
  );
}
