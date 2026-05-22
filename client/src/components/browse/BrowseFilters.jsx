import { CATEGORIES } from '../report/reportFormConstants.js';

const REPORT_TYPES = [
  { value: '', label: 'All types' },
  { value: 'lost', label: 'Lost' },
  { value: 'found', label: 'Found' },
];

export function BrowseFilters({
  reportType,
  onReportTypeChange,
  category,
  onCategoryChange,
  keyword,
  onKeywordChange,
  onSearchSubmit,
}) {
  return (
    <section className="space-y-md">
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit?.();
        }}
      >
        <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
          search
        </span>
        <input
          type="search"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="Search title, brand, location…"
          className="w-full h-12 pl-12 pr-md bg-surface-container-low border border-outline-variant rounded-xl text-on-surface font-body-md outline-none focus:border-primary transition-colors"
          aria-label="Search items"
        />
      </form>

      <div className="flex gap-xs overflow-x-auto pb-1 no-scrollbar">
        {REPORT_TYPES.map((opt) => {
          const active = reportType === opt.value;
          return (
            <button
              key={opt.value || 'all-types'}
              type="button"
              onClick={() => onReportTypeChange(opt.value)}
              className={`px-lg py-xs rounded-full font-label-sm whitespace-nowrap transition-colors ${
                active
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-xs overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => onCategoryChange('')}
          className={`px-lg py-xs rounded-full font-label-sm whitespace-nowrap transition-colors ${
            !category
              ? 'bg-primary-container text-on-primary-container shadow-sm'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          All categories
        </button>
        {CATEGORIES.map((c) => {
          const active = category === c.value;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => onCategoryChange(c.value)}
              className={`px-lg py-xs rounded-full font-label-sm whitespace-nowrap transition-colors ${
                active
                  ? 'bg-primary-container text-on-primary-container shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
