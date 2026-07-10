import { INBOX_SORT, INBOX_TYPE_FILTER } from '../../utils/chatInboxFilters.js';

function OptionChip({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-md py-xs rounded-full font-label-sm whitespace-nowrap transition-colors ${
        active
          ? 'bg-primary-container text-on-primary-container'
          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
      }`}
    >
      {label}
    </button>
  );
}

export function ChatInboxFilterPanel({ sort, typeFilter, onSortChange, onTypeFilterChange, onReset }) {
  const hasCustomFilter =
    sort !== INBOX_SORT.RECENT || typeFilter !== INBOX_TYPE_FILTER.ALL;

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-md space-y-md">
      <div>
        <p className="font-label-sm text-on-surface-variant mb-sm">Sort by</p>
        <div className="flex flex-wrap gap-xs">
          <OptionChip
            active={sort === INBOX_SORT.RECENT}
            label="Most recent"
            onClick={() => onSortChange(INBOX_SORT.RECENT)}
          />
          <OptionChip
            active={sort === INBOX_SORT.UNREAD_FIRST}
            label="Unread first"
            onClick={() => onSortChange(INBOX_SORT.UNREAD_FIRST)}
          />
        </div>
      </div>

      <div>
        <p className="font-label-sm text-on-surface-variant mb-sm">Show chats about</p>
        <div className="flex flex-wrap gap-xs">
          <OptionChip
            active={typeFilter === INBOX_TYPE_FILTER.ALL}
            label="All items"
            onClick={() => onTypeFilterChange(INBOX_TYPE_FILTER.ALL)}
          />
          <OptionChip
            active={typeFilter === INBOX_TYPE_FILTER.LOST}
            label="Lost items"
            onClick={() => onTypeFilterChange(INBOX_TYPE_FILTER.LOST)}
          />
          <OptionChip
            active={typeFilter === INBOX_TYPE_FILTER.FOUND}
            label="Found items"
            onClick={() => onTypeFilterChange(INBOX_TYPE_FILTER.FOUND)}
          />
        </div>
      </div>

      {hasCustomFilter ? (
        <button
          type="button"
          onClick={onReset}
          className="font-label-sm text-primary hover:underline"
        >
          Reset filters
        </button>
      ) : null}
    </div>
  );
}
