import { useState } from 'react';

const PRESET_COLORS = ['Black', 'White', 'Red', 'Blue', 'Gray', 'Green', 'Silver', 'Gold'];

/**
 * Multi-select color tags with optional custom entries (stored as string array).
 */
export function ColorTagInput({ value = [], onChange, id }) {
  const [customColor, setCustomColor] = useState('');

  function toggleColor(color) {
    if (value.includes(color)) {
      onChange(value.filter((c) => c !== color));
    } else {
      onChange([...value, color]);
    }
  }

  function addCustomColor() {
    const trimmed = customColor.trim();
    if (!trimmed || value.includes(trimmed)) {
      setCustomColor('');
      return;
    }
    onChange([...value, trimmed]);
    setCustomColor('');
  }

  return (
    <div className="space-y-sm" id={id}>
      <div className="flex flex-wrap gap-xs">
        {PRESET_COLORS.map((color) => {
          const selected = value.includes(color);
          return (
            <button
              key={color}
              type="button"
              onClick={() => toggleColor(color)}
              className={`px-sm py-xs rounded-full font-label-sm border transition-colors ${
                selected
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container-low text-on-surface-variant border-outline-variant'
              }`}
              aria-pressed={selected}
            >
              {color}
            </button>
          );
        })}
      </div>
      {value.filter((c) => !PRESET_COLORS.includes(c)).length > 0 ? (
        <div className="flex flex-wrap gap-xs">
          {value
            .filter((c) => !PRESET_COLORS.includes(c))
            .map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => toggleColor(color)}
                className="px-sm py-xs rounded-full font-label-sm bg-secondary-container text-on-secondary-container border border-outline-variant"
              >
                {color} ×
              </button>
            ))}
        </div>
      ) : null}
      <div className="flex gap-xs">
        <input
          type="text"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustomColor();
            }
          }}
          placeholder="Custom color"
          className="flex-1 h-10 px-sm bg-surface-container-low border border-outline-variant rounded-lg text-on-surface font-body-md outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={addCustomColor}
          className="h-10 px-md rounded-lg bg-surface-container-high font-label-sm text-primary"
        >
          Add
        </button>
      </div>
    </div>
  );
}
