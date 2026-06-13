import { AiPipelinePanel } from '../AiPipelinePanel.jsx';
import { ModeToggle } from '../ModeToggle.jsx';
import { AiExtractionPanel } from '../AiExtractionPanel.jsx';
import { CategoryMismatchBanner } from '../CategoryMismatchBanner.jsx';
import { ReportSection } from '../ReportSection.jsx';
import { Spinner } from '../../ui/Spinner.jsx';
import { DESCRIPTION_MODES, FEATURES_MODES } from '../reportFormConstants.js';

function DraftHint({ ready, children }) {
  if (!ready) return null;
  return <p className="font-caption text-primary">{children}</p>;
}

function DescriptionTextarea({ formId, id, label, value, onChange, disabled, busy }) {
  return (
    <div className="relative">
      {busy ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-t-lg bg-surface/70 backdrop-blur-sm">
          <Spinner />
        </div>
      ) : null}
      <textarea
        className="peer w-full pt-6 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none resize-y min-h-[96px] disabled:opacity-70"
        id={id}
        placeholder=" "
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-busy={busy}
      />
      <label
        className="absolute left-md top-4 text-body-md text-on-surface-variant peer-focus:top-1 peer-focus:text-caption peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-caption transition-all"
        htmlFor={id}
      >
        {label}
      </label>
    </div>
  );
}

export function ReportStepItemDetails({
  formId,
  descriptionMode,
  onDescriptionModeChange,
  description,
  onDescriptionChange,
  aiDescription,
  onAiDescriptionChange,
  aiDescriptionDraftReady,
  distinctiveFeaturesMode,
  onDistinctiveFeaturesModeChange,
  distinctiveFeatures,
  onDistinctiveFeaturesChange,
  aiDistinctiveFeatures,
  onAiDistinctiveFeaturesChange,
  aiFeaturesDraftReady,
  imageFile,
  imagePreview,
  onImageChange,
  isProcessingImage,
  isProcessingOcr,
  analyzeSnapshot,
  ocrError,
  embeddingVector,
  embeddingAvailable,
  fieldErrors,
  userSelectedCategory,
  suggestedCategory,
  detectedClassName,
  categoryMismatchAcknowledged,
  onKeepCurrentCategory,
  onUseSuggestedCategory,
}) {
  const aiBusy = isProcessingImage || isProcessingOcr;

  return (
    <>
      <ReportSection title="Image Upload" subtitle="Optional — runs OCR and AI matching signals.">
        <div className="relative group">
          <div className="w-full h-48 rounded-xl overflow-hidden shadow-sm border-2 border-primary-container bg-surface-container-low">
            {imagePreview ? (
              <img alt="Upload preview" className="w-full h-full object-cover" src={imagePreview} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-on-surface-variant font-caption">
                Upload a photo (optional)
              </div>
            )}
            {aiBusy ? (
              <div className="absolute inset-0 flex items-center justify-center bg-surface/60 backdrop-blur-sm">
                <Spinner />
              </div>
            ) : null}
            {imagePreview && !aiBusy ? (
              <div className="absolute inset-0 bg-primary/10 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="bg-surface text-primary px-lg py-sm rounded-full font-label-sm flex items-center gap-xs shadow-lg">
                  <span className="material-symbols-outlined">edit</span>
                  Change Photo
                </span>
              </div>
            ) : null}
          </div>
          <label
            className={`absolute inset-0 rounded-xl ${aiBusy ? 'pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
            htmlFor={aiBusy ? undefined : `${formId}-photo`}
          >
            <span className="sr-only">Upload image</span>
          </label>
          <input
            id={`${formId}-photo`}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            onChange={onImageChange}
            disabled={aiBusy}
            aria-busy={aiBusy}
          />
          <p className={`mt-1 font-caption text-error ${fieldErrors.image ? '' : 'hidden'}`} role="status">
            {fieldErrors.image}
          </p>
        </div>

        <AiExtractionPanel analyze={analyzeSnapshot} isLoading={isProcessingOcr} error={ocrError} />

        {suggestedCategory &&
        userSelectedCategory &&
        suggestedCategory !== userSelectedCategory &&
        !categoryMismatchAcknowledged ? (
          <CategoryMismatchBanner
            userCategory={userSelectedCategory}
            suggestedCategory={suggestedCategory}
            detectedClassName={detectedClassName}
            onKeepCurrent={onKeepCurrentCategory}
            onUseSuggested={onUseSuggestedCategory}
          />
        ) : null}
      </ReportSection>

      <ReportSection
        title="Item Description"
        subtitle="Write yourself, or use AI suggestions from your photo. Choose which version is submitted."
      >
        <p className="font-caption text-on-surface-variant">Submit with report</p>
        <ModeToggle
          name="Description source"
          value={descriptionMode}
          onChange={onDescriptionModeChange}
          options={DESCRIPTION_MODES}
        />

        <div className="space-y-md">
          <div>
            <p className="font-label-sm text-on-surface mb-xs">Write yourself</p>
            <DescriptionTextarea
              formId={formId}
              id={`${formId}-description`}
              label="Your own description"
              value={description}
              onChange={onDescriptionChange}
              disabled={aiBusy}
              busy={false}
            />
          </div>

          <div>
            <p className="font-label-sm text-on-surface mb-xs">Extract from Image</p>
            {!imageFile ? (
              <p className="font-caption text-on-surface-variant rounded-lg bg-surface-container-low px-sm py-xs mb-sm">
                Upload a photo above — extracted description will appear here. You can edit before submitting.
              </p>
            ) : null}
            <DescriptionTextarea
              formId={formId}
              id={`${formId}-ai-description`}
              label="AI draft description"
              value={aiDescription}
              onChange={onAiDescriptionChange}
              disabled={aiBusy}
              busy={aiBusy && Boolean(imageFile)}
            />
            <DraftHint ready={aiDescriptionDraftReady}>
              Suggested from your photo — edit freely; your changes will not be overwritten.
            </DraftHint>
          </div>
        </div>
      </ReportSection>

      <ReportSection
        title="Distinctive Features"
        subtitle="Marks, damage, stickers, engravings — manual entry or AI draft from the image."
      >
        <p className="font-caption text-on-surface-variant">Submit with report</p>
        <ModeToggle
          name="Distinctive features source"
          value={distinctiveFeaturesMode}
          onChange={onDistinctiveFeaturesModeChange}
          options={FEATURES_MODES}
        />

        <div className="space-y-md">
          <div>
            <p className="font-label-sm text-on-surface mb-xs">Write yourself</p>
            <textarea
              className="w-full min-h-[96px] px-md py-sm bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg outline-none resize-y font-body-md"
              id={`${formId}-distinctive`}
              value={distinctiveFeatures}
              onChange={(e) => onDistinctiveFeaturesChange(e.target.value)}
              placeholder="e.g. cracked corner, engraved name, red sticker on back"
              disabled={aiBusy}
            />
          </div>

          <div>
            <p className="font-label-sm text-on-surface mb-xs">Extract from Image</p>
            {!imageFile ? (
              <p className="font-caption text-on-surface-variant rounded-lg bg-surface-container-low px-sm py-xs mb-sm">
                Upload a photo to extract distinctive features here.
              </p>
            ) : null}
            <textarea
              className="w-full min-h-[96px] px-md py-sm bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg outline-none resize-y font-body-md disabled:opacity-70"
              id={`${formId}-ai-distinctive`}
              value={aiDistinctiveFeatures}
              onChange={(e) => onAiDistinctiveFeaturesChange(e.target.value)}
              placeholder="Bullet points from image analysis (colors, branding, parts, marks…)"
              disabled={aiBusy}
              aria-busy={aiBusy && Boolean(imageFile)}
            />
            <DraftHint ready={aiFeaturesDraftReady}>
              Structured feature bullets from your photo — edit freely; your changes will not be
              overwritten.
            </DraftHint>
          </div>
        </div>
      </ReportSection>

      <ReportSection title="AI Assistance" subtitle="Pipeline status for this upload.">
        {embeddingAvailable === false ? (
          <p className="font-caption text-on-surface-variant rounded-lg bg-surface-container-low px-sm py-xs">
            Description matching unavailable — your item can still be submitted
          </p>
        ) : null}
        <AiPipelinePanel
          hasImage={Boolean(imageFile)}
          ocrReady={Boolean(analyzeSnapshot?.ocr?.success || analyzeSnapshot?.ocr?.ocrText)}
          captionReady={Boolean(aiDescription.trim())}
          featuresReady={Boolean(aiDistinctiveFeatures.trim())}
          embeddingReady={
            embeddingAvailable === true &&
            Array.isArray(embeddingVector) &&
            embeddingVector.length > 0
          }
        />
      </ReportSection>
    </>
  );
}
