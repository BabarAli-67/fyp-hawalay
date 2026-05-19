const PIPELINE_STEPS = [
  { id: 'ocr', label: 'OCR Text Extraction', status: 'coming_soon' },
  { id: 'blip', label: 'BLIP Caption Generation', status: 'coming_soon' },
  { id: 'clip', label: 'CLIP Embedding Generation', status: 'active' },
  { id: 'match', label: 'Smart Matching', status: 'coming_soon' },
];

/**
 * Visual AI pipeline — educational UI; BLIP/CLIP reflect current FastAPI proxy when image processed.
 */
export function AiPipelinePanel({ hasImage, captionReady, embeddingReady }) {
  function stepLabel(step) {
    if (step.id === 'blip') {
      if (!hasImage) return 'Upload an image';
      if (captionReady) return 'Caption received';
      return 'Coming Soon';
    }
    if (step.id === 'clip') {
      if (!hasImage) return 'Upload an image';
      if (embeddingReady) return 'Embedding received';
      return 'Coming Soon';
    }
    return 'Coming Soon';
  }

  function stepTone(step) {
    if (step.id === 'blip' && captionReady) return 'text-primary';
    if (step.id === 'clip' && embeddingReady) return 'text-primary';
    if (step.status === 'coming_soon') return 'text-on-surface-variant';
    return 'text-on-surface-variant';
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
            <p className={`font-caption ${stepTone(step)}`}>
              {step.id === 'ocr' || step.id === 'match' ? 'Coming Soon' : stepLabel(step)}
              {/* TODO: Wire OCR via FastAPI when OCR endpoint is ready */}
              {/* TODO: Wire smart matching when matchingService is implemented */}
            </p>
          </div>
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
            {step.id === 'blip' && captionReady
              ? 'check_circle'
              : step.id === 'clip' && embeddingReady
                ? 'check_circle'
                : 'schedule'}
          </span>
        </li>
      ))}
    </ol>
  );
}
