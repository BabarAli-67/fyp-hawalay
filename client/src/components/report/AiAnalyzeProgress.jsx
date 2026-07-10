import { useEffect, useMemo, useState } from 'react';

const PIPELINE_STEPS = [
  { id: 'upload', label: 'Image upload' },
  { id: 'object', label: 'Object detection' },
  { id: 'ocr', label: 'OCR text extraction' },
  { id: 'gemini', label: 'Gemini caption & features' },
];

/** Visual phase while waiting for analyze-image (server runs full pipeline in one request). */
const ANALYZE_PHASE_2_MS = 2500;
const ANALYZE_PHASE_3_MS = 6000;

function stepStatusFromAnalyze(stepId, { hasImage, analyze, isAnalyzing, analyzePhase, hasError }) {
  if (stepId === 'upload') {
    if (!hasImage) return 'pending';
    return 'complete';
  }

  if (hasError && isAnalyzing === false) {
    if (stepId === 'object' && analyzePhase >= 1) return 'error';
    if (stepId === 'ocr' && analyzePhase >= 2) return 'error';
    if (stepId === 'gemini') return 'error';
    if (analyzePhase === 0 && stepId === 'object') return 'error';
    return analyzePhase > 0 ? 'skipped' : 'pending';
  }

  if (analyze) {
    if (stepId === 'object') {
      const status = analyze.objectDetection?.status;
      const hasObjects = (analyze.objectDetection?.detectedObjects || []).length > 0;
      if (status === 'success' || hasObjects) return 'complete';
      if (status === 'skipped' || status === 'unavailable') return 'skipped';
      return 'complete';
    }
    if (stepId === 'ocr') {
      const ocr = analyze.ocr;
      if (ocr?.success || ocr?.ocrText) return 'complete';
      if (ocr?.status === 'degraded') return 'complete';
      if (ocr?.status === 'no_regions') return 'skipped';
      return 'skipped';
    }
    if (stepId === 'gemini') {
      const hasCaption = Boolean(analyze.caption?.trim());
      const hasFeatures = Boolean(analyze.distinctiveFeatures?.trim() || analyze.featurePoints?.length);
      if (hasCaption || hasFeatures) return 'complete';
      if (analyze.visionStatus === 'ocr_fallback') return 'complete';
      if (analyze.visionStatus === 'unavailable' || analyze.visionStatus === 'rate_limited') {
        return 'skipped';
      }
      return analyze.visionStatus === 'empty' ? 'skipped' : 'complete';
    }
  }

  if (!isAnalyzing) return 'pending';

  const phaseIndex = { object: 1, ocr: 2, gemini: 3 };
  const idx = phaseIndex[stepId];
  if (analyzePhase > idx) return 'complete';
  if (analyzePhase === idx) return 'active';
  return 'pending';
}

function statusLabel(status) {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'active':
      return 'In progress…';
    case 'skipped':
      return 'Skipped';
    case 'error':
      return 'Failed';
    default:
      return 'Waiting';
  }
}

function statusIcon(status) {
  switch (status) {
    case 'complete':
      return 'check_circle';
    case 'active':
      return 'progress_activity';
    case 'skipped':
      return 'remove_circle_outline';
    case 'error':
      return 'error';
    default:
      return 'schedule';
  }
}

function statusIconClass(status) {
  switch (status) {
    case 'complete':
      return 'text-primary';
    case 'active':
      return 'text-primary animate-spin';
    case 'skipped':
      return 'text-on-surface-variant';
    case 'error':
      return 'text-error';
    default:
      return 'text-on-surface-variant';
  }
}

/**
 * Analyze-image pipeline progress (Upload → Object → OCR → Gemini).
 * Used on ReportItemPage; does not call APIs — reflects client analyze state only.
 */
export function AiAnalyzeProgress({
  hasImage,
  isAnalyzing,
  analyze,
  hasError = false,
}) {
  const [analyzePhase, setAnalyzePhase] = useState(0);

  useEffect(() => {
    if (!isAnalyzing) {
      setAnalyzePhase(0);
      return undefined;
    }

    setAnalyzePhase(1);
    const phase2 = window.setTimeout(() => setAnalyzePhase(2), ANALYZE_PHASE_2_MS);
    const phase3 = window.setTimeout(() => setAnalyzePhase(3), ANALYZE_PHASE_3_MS);

    return () => {
      window.clearTimeout(phase2);
      window.clearTimeout(phase3);
    };
  }, [isAnalyzing]);

  const steps = useMemo(
    () =>
      PIPELINE_STEPS.map((step) => ({
        ...step,
        status: stepStatusFromAnalyze(step.id, {
          hasImage,
          analyze,
          isAnalyzing,
          analyzePhase,
          hasError,
        }),
      })),
    [hasImage, analyze, isAnalyzing, analyzePhase, hasError],
  );

  const completedCount = steps.filter((s) => s.status === 'complete' || s.status === 'skipped').length;
  const progressPct = Math.round((completedCount / PIPELINE_STEPS.length) * 100);
  const displayPct = isAnalyzing && !analyze ? Math.min(progressPct + 12, 92) : progressPct;

  if (!hasImage) return null;

  return (
    <div
      className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-md py-md space-y-md"
      role="region"
      aria-label="AI analysis progress"
      aria-busy={isAnalyzing}
    >
      <div className="flex items-center justify-between gap-sm">
        <p className="font-label-sm text-on-surface">AI analysis pipeline</p>
        {isAnalyzing ? (
          <span className="font-caption text-primary flex items-center gap-xs">
            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            Running…
          </span>
        ) : (
          <span className="font-caption text-on-surface-variant">{displayPct}%</span>
        )}
      </div>

      <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${displayPct}%` }}
          role="progressbar"
          aria-valuenow={displayPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Analysis progress"
        />
      </div>

      <ol className="space-y-sm">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-start gap-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-label-sm text-on-surface-variant">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-label-sm text-on-surface">{step.label}</p>
              <p
                className={`font-caption ${
                  step.status === 'complete'
                    ? 'text-primary'
                    : step.status === 'active'
                      ? 'text-primary'
                      : step.status === 'error'
                        ? 'text-error'
                        : 'text-on-surface-variant'
                }`}
              >
                {statusLabel(step.status)}
              </p>
            </div>
            <span className={`material-symbols-outlined text-[20px] ${statusIconClass(step.status)}`}>
              {statusIcon(step.status)}
            </span>
          </li>
        ))}
      </ol>

      {isAnalyzing ? (
        <p className="font-caption text-on-surface-variant">
          Express → FastAPI — object detection, OCR, and Gemini run on the server. This may take up to
          a minute.
        </p>
      ) : null}
    </div>
  );
}
