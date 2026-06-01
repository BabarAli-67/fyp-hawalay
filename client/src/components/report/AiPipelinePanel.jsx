const PIPELINE_STEPS = [
  { id: 'ocr', label: 'OCR text extraction' },
  { id: 'features', label: 'Distinctive features' },
  { id: 'blip', label: 'AI description' },
  { id: 'clip', label: 'Embedding generation' },
  { id: 'match', label: 'Smart matching' },
];

/**
 * AI pipeline status on the report form (OCR + features + caption + embedding).
 */
export function AiPipelinePanel({
  hasImage,
  ocrReady,
  featuresReady,
  captionReady,
  embeddingReady,
}) {
  function stepLabel(step) {
    if (step.id === 'ocr') {
      if (!hasImage) return 'Upload an image';
      if (ocrReady) return 'Text extracted';
      return 'Pending upload processing';
    }
    if (step.id === 'features') {
      if (!hasImage) return 'Upload an image';
      if (featuresReady) return 'Feature bullets ready';
      return 'Waiting for image';
    }
    if (step.id === 'blip') {
      if (!hasImage) return 'Upload an image';
      if (captionReady) return 'Description ready';
      return 'Waiting for image';
    }
    if (step.id === 'clip') {
      if (!hasImage) return 'Upload an image';
      if (embeddingReady) return 'Embedding received';
      return 'Waiting for image';
    }
  }

  function stepDone(step) {
    if (step.id === 'ocr') return ocrReady;
    if (step.id === 'features') return featuresReady;
    if (step.id === 'blip') return captionReady;
    if (step.id === 'clip') return embeddingReady;
    return false;
  }

  return (
    <ol className="space-y-sm">
      {PIPELINE_STEPS.map((step, index) => (
        <li key={step.id} className="flex items-start gap-sm">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-label-sm text-on-surface-variant">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-label-sm text-on-surface">{step.label}</p>
            <p
              className={`font-caption ${
                stepDone(step) ? 'text-primary' : 'text-on-surface-variant'
              }`}
            >
              {step.id === 'match' ? 'After report submit (background)' : stepLabel(step)}
            </p>
          </div>
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
            {stepDone(step) ? 'check_circle' : 'schedule'}
          </span>
        </li>
      ))}
    </ol>
  );
}
