import { useState } from 'react';
import { dedupeFeatureChips } from '../../utils/analyzeExtraction.js';

/**
 * Chip-based editor for distinctive features (serializes to bullet-newline string on submit).
 */
export function DistinctiveFeaturesChipInput({
  id,
  label = 'Distinctive features',
  chips,
  onChange,
  disabled = false,
}) {
  const [draft, setDraft] = useState('');

  function addChip(raw) {
    const text = String(raw || '').trim();
    if (!text || disabled) return false;

    const exists = chips.some((chip) => chip.toLowerCase() === text.toLowerCase());
    if (exists) return false;

    onChange(dedupeFeatureChips([...chips, text]));
    return true;
  }

  function removeChip(index) {
    if (disabled) return;
    onChange(chips.filter((_, chipIndex) => chipIndex !== index));
  }

  function handleAddClick() {
    if (addChip(draft)) {
      setDraft('');
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (addChip(draft)) {
        setDraft('');
      }
    }
  }

  return (
    <div className="space-y-sm">
      <label
        className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider"
        htmlFor={id}
      >
        {label}
      </label>

      {chips.length ? (
        <ul className="flex flex-wrap gap-xs" aria-label={`${label} tags`}>
          {chips.map((chip, index) => (
            <li key={`${chip.toLowerCase()}-${index}`}>
              <span className="inline-flex items-center gap-xs max-w-full rounded-full border border-outline-variant/40 bg-primary-container/60 pl-md pr-xs py-xs font-body-md text-on-primary-container">
                <span className="truncate">{chip}</span>
                <button
                  type="button"
                  onClick={() => removeChip(index)}
                  disabled={disabled}
                  className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-on-primary-container/80 hover:bg-on-primary-container/10 hover:text-on-primary-container active:scale-95 transition-transform disabled:opacity-50"
                  aria-label={`Remove ${chip}`}
                >
                  <span className="material-symbols-outlined text-[16px] leading-none">close</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-sm">
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Add a feature..."
          autoComplete="off"
          className="flex-1 min-w-0 h-12 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg outline-none font-body-md disabled:opacity-70"
        />
        <button
          type="button"
          onClick={handleAddClick}
          disabled={disabled || !draft.trim()}
          className="shrink-0 h-12 px-md rounded-lg border border-outline-variant/40 bg-surface-container-low font-label-sm text-primary flex items-center gap-xs active:scale-[0.98] transition-transform hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add
        </button>
      </div>
    </div>
  );
}
