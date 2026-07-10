export const REPORT_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'returned', label: 'Returned' },
];

function FilterChip({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'active-chip px-lg py-xs rounded-full font-label-sm whitespace-nowrap premium-shadow shrink-0 min-h-[36px]'
          : 'bg-surface-container text-on-surface-variant px-lg py-xs rounded-full font-label-sm whitespace-nowrap hover:bg-surface-container-high transition-colors shrink-0 min-h-[36px]'
      }
    >
      {label}
    </button>
  );
}

/**
 * All / Active / Returned filters for Profile → My Reports.
 */
export function ReportFilterBar({ activeFilter, onFilterChange }) {
  return (
    <section
      className="flex gap-xs overflow-x-auto pb-md no-scrollbar -mx-1 px-1"
      aria-label="Report filters"
    >
      {REPORT_FILTERS.map((filter) => (
        <FilterChip
          key={filter.id}
          label={filter.label}
          active={activeFilter === filter.id}
          onClick={() => onFilterChange(filter.id)}
        />
      ))}
    </section>
  );
}
