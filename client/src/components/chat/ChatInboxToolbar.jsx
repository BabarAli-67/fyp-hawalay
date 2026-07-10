import { INBOX_TABS } from '../../utils/chatInboxFilters.js';

function TabButton({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-xs px-md py-1.5 rounded-full font-label-sm whitespace-nowrap transition-colors min-h-[34px] ${
        active
          ? 'bg-primary text-on-primary shadow-sm'
          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
      }`}
    >
      <span>{label}</span>
      {count > 0 ? (
        <span
          className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full text-[11px] font-bold leading-none ${
            active ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-highest text-on-surface'
          }`}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </button>
  );
}

export function ChatInboxToolbar({
  activeTab,
  onTabChange,
  allCount,
  unreadCount,
  searchQuery,
  onSearchChange,
  filterOpen,
  onFilterToggle,
}) {
  return (
    <section className="space-y-1.5" aria-label="Message filters">
      <div className="flex gap-sm">
        <TabButton
          active={activeTab === INBOX_TABS.ALL}
          label="All"
          count={allCount}
          onClick={() => onTabChange(INBOX_TABS.ALL)}
        />
        <TabButton
          active={activeTab === INBOX_TABS.UNREAD}
          label="Unread"
          count={unreadCount}
          onClick={() => onTabChange(INBOX_TABS.UNREAD)}
        />
      </div>

      <div className="flex gap-sm items-center">
        <div className="relative flex-1">
          <span
            className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none"
            aria-hidden
          >
            search
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="w-full h-12 pl-12 pr-md bg-surface-container-low border border-outline-variant/40 rounded-xl text-on-surface font-body-md outline-none focus:border-primary transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={onFilterToggle}
          aria-expanded={filterOpen}
          aria-label="Filter and sort conversations"
          className={`shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center transition-colors ${
            filterOpen
              ? 'bg-primary-container text-on-primary-container border-primary/30'
              : 'bg-surface-container-low text-on-surface-variant border-outline-variant/40 hover:bg-surface-container'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">tune</span>
        </button>
      </div>
    </section>
  );
}
