import { ReportSection } from '../ReportSection.jsx';

export function ReportStepReview({
  reportType,
  title,
  brand,
  colors,
  category,
  date,
  locationName,
  secondaryLocationName,
  secondaryLocationCoordinates,
  description,
  distinctiveFeatures,
  contactLabel,
  imageFile,
  isOnline,
  onGoToStep,
}) {
  return (
    <ReportSection title="Submission Summary" subtitle="Review before submitting.">
      <dl className="space-y-sm font-body-md text-on-surface">
        <div className="flex justify-between gap-md">
          <dt className="text-on-surface-variant">Type</dt>
          <dd className="capitalize text-right">{reportType}</dd>
        </div>
        <div className="flex justify-between gap-md">
          <dt className="text-on-surface-variant">Title</dt>
          <dd className="text-right truncate max-w-[60%]">{title.trim() || '—'}</dd>
        </div>
        {brand.trim() ? (
          <div className="flex justify-between gap-md">
            <dt className="text-on-surface-variant">Brand</dt>
            <dd className="text-right">{brand.trim()}</dd>
          </div>
        ) : null}
        {colors.length > 0 ? (
          <div className="flex justify-between gap-md">
            <dt className="text-on-surface-variant">Colors</dt>
            <dd className="text-right">{colors.join(', ')}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-md">
          <dt className="text-on-surface-variant">Category</dt>
          <dd>{category}</dd>
        </div>
        <div className="flex justify-between gap-md">
          <dt className="text-on-surface-variant">{reportType === 'lost' ? 'Date lost' : 'Date found'}</dt>
          <dd>{date || '—'}</dd>
        </div>
        {description.trim() ? (
          <div className="flex flex-col gap-xs">
            <dt className="text-on-surface-variant">Description</dt>
            <dd className="text-on-surface font-body-md">{description.trim()}</dd>
          </div>
        ) : null}
        {distinctiveFeatures.trim() ? (
          <div className="flex flex-col gap-xs">
            <dt className="text-on-surface-variant">Distinctive features</dt>
            <dd className="text-on-surface font-body-md">{distinctiveFeatures.trim()}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-md">
          <dt className="text-on-surface-variant">Primary location</dt>
          <dd className="text-right truncate max-w-[60%]">{locationName.trim() || '—'}</dd>
        </div>
        {secondaryLocationName.trim() || secondaryLocationCoordinates ? (
          <div className="flex justify-between gap-md">
            <dt className="text-on-surface-variant">Secondary location</dt>
            <dd className="text-right truncate max-w-[60%]">
              {secondaryLocationName.trim() || (secondaryLocationCoordinates ? 'Pinned on map' : '—')}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-md">
          <dt className="text-on-surface-variant">Contact</dt>
          <dd className="text-right text-caption max-w-[65%]">{contactLabel}</dd>
        </div>
        <div className="flex justify-between gap-md">
          <dt className="text-on-surface-variant">Photo</dt>
          <dd>{imageFile ? 'Attached' : 'None'}</dd>
        </div>
        {!isOnline ? (
          <p className="font-caption text-primary pt-sm">You are offline — report will queue for sync.</p>
        ) : null}
      </dl>

      <div className="pt-md mt-md border-t border-outline-variant/30 space-y-sm">
        <p className="font-label-sm text-on-surface-variant uppercase tracking-wider">Edit before submit</p>
        <div className="flex flex-col gap-sm">
          <button
            type="button"
            onClick={() => onGoToStep(1)}
            className="w-full h-12 rounded-xl border border-outline-variant text-on-surface font-label-sm active:scale-[0.99] transition-transform flex items-center justify-center gap-xs hover:bg-surface-container-high/50"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Basic information
          </button>
          <button
            type="button"
            onClick={() => onGoToStep(2)}
            className="w-full h-12 rounded-xl border border-outline-variant text-on-surface font-label-sm active:scale-[0.99] transition-transform flex items-center justify-center gap-xs hover:bg-surface-container-high/50"
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            Item details &amp; photo
          </button>
          <button
            type="button"
            onClick={() => onGoToStep(3)}
            className="w-full h-12 rounded-xl border border-outline-variant text-on-surface font-label-sm active:scale-[0.99] transition-transform flex items-center justify-center gap-xs hover:bg-surface-container-high/50"
          >
            <span className="material-symbols-outlined text-[18px]">location_on</span>
            Location &amp; contact
          </button>
        </div>
      </div>
    </ReportSection>
  );
}
