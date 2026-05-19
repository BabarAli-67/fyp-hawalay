/**
 * Two-option mode selector (manual vs future AI). Used for description & distinctive features.
 */
export function ModeToggle({ value, onChange, options, name }) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="flex rounded-xl overflow-hidden border border-outline-variant bg-surface-container-low"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-sm px-xs font-label-sm transition-colors ${
            value === opt.value
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
