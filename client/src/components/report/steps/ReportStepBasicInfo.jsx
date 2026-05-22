import { ColorTagInput } from '../ColorTagInput.jsx';
import { ReportSection } from '../ReportSection.jsx';
import { BRAND_SUGGESTIONS, CATEGORIES } from '../reportFormConstants.js';

export function ReportStepBasicInfo({
  formId,
  reportType,
  onReportTypeChange,
  title,
  onTitleChange,
  brand,
  onBrandChange,
  colors,
  onColorsChange,
  category,
  onCategoryChange,
  date,
  onDateChange,
  fieldErrors,
}) {
  return (
    <ReportSection title="Basic Information" subtitle="What was lost or found?">
      <div className="space-y-sm">
        <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
          Report type
        </span>
        <div className="flex rounded-xl overflow-hidden border border-outline-variant bg-surface-container-low">
          <button
            type="button"
            onClick={() => onReportTypeChange('lost')}
            className={`flex-1 py-sm font-label-sm transition-colors ${
              reportType === 'lost'
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Lost
          </button>
          <button
            type="button"
            onClick={() => onReportTypeChange('found')}
            className={`flex-1 py-sm font-label-sm transition-colors ${
              reportType === 'found'
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Found
          </button>
        </div>
        <p className={`font-caption text-error ${fieldErrors.reportType ? '' : 'hidden'}`} role="status">
          {fieldErrors.reportType}
        </p>
      </div>

      <div className="relative">
        <input
          className="peer w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none"
          id={`${formId}-title`}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder=" "
          autoComplete="off"
        />
        <label
          className="absolute left-md top-4 text-body-md text-on-surface-variant peer-focus:top-1 peer-focus:text-caption peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-caption transition-all"
          htmlFor={`${formId}-title`}
        >
          Title
        </label>
        <p className={`mt-1 font-caption text-error ${fieldErrors.title ? '' : 'hidden'}`} role="status">
          {fieldErrors.title}
        </p>
      </div>

      <div className="relative">
        <input
          className="peer w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none"
          id={`${formId}-brand`}
          value={brand}
          onChange={(e) => onBrandChange(e.target.value)}
          placeholder=" "
          list={`${formId}-brand-suggestions`}
          autoComplete="off"
        />
        <datalist id={`${formId}-brand-suggestions`}>
          {BRAND_SUGGESTIONS.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
        <label
          className="absolute left-md top-4 text-body-md text-on-surface-variant peer-focus:top-1 peer-focus:text-caption peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-caption transition-all"
          htmlFor={`${formId}-brand`}
        >
          Brand
        </label>
        <p className="mt-1 font-caption text-on-surface-variant">e.g. Apple, Samsung, Nike, Lenovo</p>
      </div>

      <div className="space-y-xs">
        <label className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
          Color(s)
        </label>
        <ColorTagInput id={`${formId}-colors`} value={colors} onChange={onColorsChange} />
      </div>

      <div className="space-y-sm">
        <label
          className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider"
          htmlFor={`${formId}-category`}
        >
          Category
        </label>
        <select
          id={`${formId}-category`}
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="w-full h-14 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none font-body-md"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <p className={`font-caption text-error ${fieldErrors.category ? '' : 'hidden'}`} role="status">
          {fieldErrors.category}
        </p>
      </div>

      <div className="relative">
        <input
          className="peer w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none"
          id={`${formId}-date`}
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
        />
        <label
          className="absolute left-md top-1 text-caption text-primary transition-all"
          htmlFor={`${formId}-date`}
        >
          {reportType === 'lost' ? 'Date lost' : 'Date found'}
        </label>
        <p className={`mt-1 font-caption text-error ${fieldErrors.date ? '' : 'hidden'}`} role="status">
          {fieldErrors.date}
        </p>
      </div>
    </ReportSection>
  );
}
