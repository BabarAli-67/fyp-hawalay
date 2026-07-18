import { useEffect, useState } from 'react';
import { CATEGORIES } from '../report/reportFormConstants.js';
import { Button } from '../ui/Button.jsx';

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function EditReportModal({ item, open, saving, error, onClose, onSave }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!open || !item) return;
    setForm({
      reportType: item.reportType || 'lost',
      title: item.title || '',
      category: item.category || 'Other',
      brand: item.brand || '',
      colors: Array.isArray(item.colors) ? item.colors.join(', ') : '',
      date: toDateInput(item.date),
      locationName: item.locationName || '',
      secondaryLocationName: item.secondaryLocationName || '',
      description: item.description || '',
      distinctiveFeatures: item.distinctiveFeatures || '',
      contactPreference: item.contactPreference || 'in_app_chat',
    });
  }, [open, item]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, saving, onClose]);

  if (!open || !form) return null;

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  function handleSubmit(event) {
    event.preventDefault();
    onSave({
      ...form,
      title: form.title.trim(),
      brand: form.brand.trim(),
      locationName: form.locationName.trim(),
      secondaryLocationName: form.secondaryLocationName.trim(),
      description: form.description.trim(),
      distinctiveFeatures: form.distinctiveFeatures.trim(),
      colors: form.colors
        .split(',')
        .map((color) => color.trim())
        .filter(Boolean),
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-md"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-report-title"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl border border-outline-variant/30 bg-surface shadow-xl sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-outline-variant/30 px-md py-sm">
          <div>
            <h2 id="edit-report-title" className="font-h3 text-h3 text-on-surface">
              Edit report
            </h2>
            <p className="font-caption text-on-surface-variant">
              Update the information shown in this report.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
            aria-label="Close edit report"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto">
          <div className="space-y-md p-md">
            {error ? (
              <p className="rounded-lg bg-error-container px-md py-sm font-caption text-on-error-container" role="alert">
                {error}
              </p>
            ) : null}

            <fieldset className="space-y-sm">
              <legend className="font-label-sm text-on-surface-variant">Report type</legend>
              <div className="grid grid-cols-2 gap-sm">
                {['lost', 'found'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => update('reportType', type)}
                    aria-pressed={form.reportType === type}
                    className={`h-11 rounded-xl border font-label-sm capitalize ${
                      form.reportType === type
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-outline-variant bg-surface-container-low text-on-surface'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block space-y-xs">
              <span className="font-label-sm text-on-surface-variant">Item name</span>
              <input
                value={form.title}
                onChange={(event) => update('title', event.target.value)}
                maxLength={100}
                required
                className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-low px-md text-on-surface outline-none focus:border-primary"
              />
            </label>

            <fieldset className="space-y-sm">
              <legend className="font-label-sm text-on-surface-variant">Category</legend>
              <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => update('category', category.value)}
                    aria-pressed={form.category === category.value}
                    className={`min-h-[44px] rounded-xl border px-sm font-label-sm ${
                      form.category === category.value
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-outline-variant bg-surface-container-low text-on-surface'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-md sm:grid-cols-2">
              <label className="block space-y-xs">
                <span className="font-label-sm text-on-surface-variant">Brand</span>
                <input
                  value={form.brand}
                  onChange={(event) => update('brand', event.target.value)}
                  maxLength={100}
                  className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-low px-md text-on-surface outline-none focus:border-primary"
                />
              </label>
              <label className="block space-y-xs">
                <span className="font-label-sm text-on-surface-variant">Date</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => update('date', event.target.value)}
                  required
                  className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-low px-md text-on-surface outline-none focus:border-primary"
                />
              </label>
            </div>

            <label className="block space-y-xs">
              <span className="font-label-sm text-on-surface-variant">Colors</span>
              <input
                value={form.colors}
                onChange={(event) => update('colors', event.target.value)}
                placeholder="Black, silver, blue"
                className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-low px-md text-on-surface outline-none focus:border-primary"
              />
              <span className="font-caption text-on-surface-variant">Separate colors with commas.</span>
            </label>

            <label className="block space-y-xs">
              <span className="font-label-sm text-on-surface-variant">Primary location</span>
              <input
                value={form.locationName}
                onChange={(event) => update('locationName', event.target.value)}
                maxLength={200}
                required
                className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-low px-md text-on-surface outline-none focus:border-primary"
              />
            </label>

            <label className="block space-y-xs">
              <span className="font-label-sm text-on-surface-variant">Secondary location (optional)</span>
              <input
                value={form.secondaryLocationName}
                onChange={(event) => update('secondaryLocationName', event.target.value)}
                maxLength={200}
                className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-low px-md text-on-surface outline-none focus:border-primary"
              />
            </label>

            <label className="block space-y-xs">
              <span className="font-label-sm text-on-surface-variant">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                maxLength={1000}
                rows={4}
                className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-on-surface outline-none focus:border-primary"
              />
            </label>

            <label className="block space-y-xs">
              <span className="font-label-sm text-on-surface-variant">Distinctive features</span>
              <textarea
                value={form.distinctiveFeatures}
                onChange={(event) => update('distinctiveFeatures', event.target.value)}
                maxLength={500}
                rows={3}
                className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-on-surface outline-none focus:border-primary"
              />
            </label>

            <label className="block space-y-xs">
              <span className="font-label-sm text-on-surface-variant">Contact preference</span>
              <select
                value={form.contactPreference}
                onChange={(event) => update('contactPreference', event.target.value)}
                className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-low px-md text-on-surface outline-none focus:border-primary"
              >
                <option value="in_app_chat">In-app chat</option>
                <option value="show_email">Show email</option>
              </select>
            </label>
          </div>

          <footer className="sticky bottom-0 flex gap-sm border-t border-outline-variant/30 bg-surface p-md">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </footer>
        </form>
      </section>
    </div>
  );
}
