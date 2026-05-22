import { AiPipelinePanel } from '../AiPipelinePanel.jsx';
import { ModeToggle } from '../ModeToggle.jsx';
import { ReportSection } from '../ReportSection.jsx';
import { Spinner } from '../../ui/Spinner.jsx';
import { DESCRIPTION_MODES, FEATURES_MODES } from '../reportFormConstants.js';

export function ReportStepItemDetails({
  formId,
  descriptionMode,
  onDescriptionModeChange,
  description,
  onDescriptionChange,
  distinctiveFeaturesMode,
  onDistinctiveFeaturesModeChange,
  distinctiveFeatures,
  onDistinctiveFeaturesChange,
  imageFile,
  imagePreview,
  onImageChange,
  isProcessingImage,
  captionFromAi,
  embeddingVector,
  fieldErrors,
}) {
  return (
    <>
      <ReportSection title="Image Upload" subtitle="Optional — improves AI caption and future matching.">
        <div className="relative group">
          <div className="w-full h-48 rounded-xl overflow-hidden shadow-sm border-2 border-primary-container bg-surface-container-low">
            {imagePreview ? (
              <img alt="" className="w-full h-full object-cover" src={imagePreview} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-on-surface-variant font-caption">
                Upload a photo (optional)
              </div>
            )}
            {imagePreview ? (
              <div className="absolute inset-0 bg-primary/10 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="bg-surface text-primary px-lg py-sm rounded-full font-label-sm flex items-center gap-xs shadow-lg">
                  <span className="material-symbols-outlined">edit</span>
                  Change Photo
                </span>
              </div>
            ) : null}
          </div>
          <label className="absolute inset-0 cursor-pointer rounded-xl" htmlFor={`${formId}-photo`}>
            <span className="sr-only">Upload image</span>
          </label>
          <input
            id={`${formId}-photo`}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            onChange={onImageChange}
            disabled={isProcessingImage}
          />
          <p className={`mt-1 font-caption text-error ${fieldErrors.image ? '' : 'hidden'}`} role="status">
            {fieldErrors.image}
          </p>
        </div>
      </ReportSection>

      <ReportSection title="Item Description" subtitle="Describe the item for matching.">
        <ModeToggle
          name="Description mode"
          value={descriptionMode}
          onChange={onDescriptionModeChange}
          options={DESCRIPTION_MODES}
        />
        {descriptionMode === 'ai' && !imageFile ? (
          <p className="font-caption text-on-surface-variant rounded-lg bg-surface-container-low px-sm py-xs">
            AI caption generation coming soon — upload a photo above or write the description yourself.
          </p>
        ) : null}
        <div className="relative">
          {isProcessingImage ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-t-lg bg-surface/70 backdrop-blur-sm">
              <Spinner />
            </div>
          ) : null}
          <textarea
            className="peer w-full pt-6 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none resize-y min-h-[96px] disabled:opacity-70"
            id={`${formId}-description`}
            placeholder=" "
            rows={4}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            disabled={isProcessingImage}
            aria-busy={isProcessingImage}
          />
          <label
            className="absolute left-md top-4 text-body-md text-on-surface-variant peer-focus:top-1 peer-focus:text-caption peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-caption transition-all"
            htmlFor={`${formId}-description`}
          >
            Detailed description
          </label>
          <p className={`mt-1 font-caption text-error ${fieldErrors.description ? '' : 'hidden'}`} role="status">
            {fieldErrors.description}
          </p>
        </div>
        {captionFromAi ? (
          <p className="font-caption text-primary">Caption suggested from your photo — you can edit anytime.</p>
        ) : null}
      </ReportSection>

      <ReportSection title="Distinctive Features" subtitle="Marks, damage, stickers, engravings, etc.">
        <ModeToggle
          name="Distinctive features mode"
          value={distinctiveFeaturesMode}
          onChange={onDistinctiveFeaturesModeChange}
          options={FEATURES_MODES}
        />
        {distinctiveFeaturesMode === 'ai' ? (
          <div
            className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-md py-md space-y-sm"
            role="status"
          >
            <p className="font-label-sm text-on-surface">AI feature extraction coming soon</p>
            <p className="font-caption text-on-surface-variant">
              OCR and vision models will suggest distinctive traits from your photo. For now, switch to “Write
              yourself” or enter details below after we enable this step.
            </p>
            <textarea
              className="w-full min-h-[72px] px-md py-sm bg-surface-container-highest border border-outline-variant rounded-lg text-on-surface-variant font-body-md resize-y opacity-60 cursor-not-allowed"
              disabled
              placeholder="AI feature extraction coming soon"
              aria-disabled="true"
            />
          </div>
        ) : (
          <textarea
            className="w-full min-h-[96px] px-md py-sm bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg outline-none resize-y font-body-md"
            id={`${formId}-distinctive`}
            value={distinctiveFeatures}
            onChange={(e) => onDistinctiveFeaturesChange(e.target.value)}
            placeholder="e.g. cracked corner, engraved name, red sticker on back"
          />
        )}
      </ReportSection>

      <ReportSection title="AI Assistance" subtitle="Pipeline preview — models connect in a later release.">
        <AiPipelinePanel
          hasImage={Boolean(imageFile)}
          captionReady={captionFromAi && Boolean(description.trim())}
          embeddingReady={Array.isArray(embeddingVector) && embeddingVector.length > 0}
        />
      </ReportSection>
    </>
  );
}
