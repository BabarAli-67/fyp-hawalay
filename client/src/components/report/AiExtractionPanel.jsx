import { formatConfidence } from '../../utils/normalizeOcrResponse.js';
import { getExtractionRows } from '../../utils/analyzeExtraction.js';

function FieldRow({ label, field }) {
  if (!field?.value) return null;

  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-md py-sm">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0 flex-1">
          <p className="font-caption text-on-surface-variant">{label}</p>
          <p className="font-body-md text-on-surface break-all">{field.value}</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary-container px-sm py-xs font-caption text-on-primary-container">
          {formatConfidence(field.confidence)}
        </span>
      </div>
    </div>
  );
}

function DetectionRow({ detection }) {
  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-md py-sm flex items-center justify-between gap-sm">
      <div>
        <p className="font-body-md text-on-surface capitalize">
          {detection.className.replace(/_/g, ' ')}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-secondary-container px-sm py-xs font-caption text-on-secondary-container">
        {formatConfidence(detection.confidence)}
      </span>
    </div>
  );
}

/**
 * Structured AI extraction results (document OCR + future object detections).
 */
export function AiExtractionPanel({ analyze, isLoading, error }) {
  if (isLoading) {
    return (
      <div
        className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-md py-md"
        role="status"
      >
        <p className="font-label-sm text-on-surface flex items-center gap-xs">
          <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          Analyzing image…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl border border-outline-variant/30 bg-error-container/30 px-md py-md"
        role="alert"
      >
        <p className="font-label-sm text-on-error-container">{error}</p>
      </div>
    );
  }

  const extractionRows = getExtractionRows(analyze);
  const ocr = analyze?.ocr;
  const objects = analyze?.objectDetection?.detectedObjects || [];
  const objectStatus = analyze?.objectDetection?.status;

  if (!extractionRows.length && !objects.length && objectStatus !== 'unavailable') {
    return null;
  }

  const textRows = extractionRows.filter((r) => r.value);
  const objectRows = extractionRows.filter((r) => !r.value && r.confidence > 0);
  const ocrSource = analyze?.models?.ocr || 'card_ocr_v1';

  return (
    <div className="space-y-md" role="region" aria-label="AI extraction results">
      {textRows.length > 0 || ocr?.ocrText ? (
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-md py-md space-y-sm">
          <div className="flex items-center justify-between gap-sm">
            <p className="font-label-sm text-on-surface">
              Extracted text · {ocrSource}
              {ocr?.documentType ? ` · ${ocr.documentType.replace(/_/g, ' ')}` : ''}
            </p>
            {ocr?.processingTimeMs > 0 ? (
              <span className="font-caption text-on-surface-variant">
                {Math.round(ocr.processingTimeMs)} ms
              </span>
            ) : null}
          </div>

          {textRows.length > 0 ? (
            <div className="space-y-sm">
              {textRows.map((row) => (
                <FieldRow
                  key={`${row.source}-${row.key}`}
                  label={row.label}
                  field={{ value: row.value, confidence: row.confidence }}
                />
              ))}
            </div>
          ) : ocr?.ocrText ? (
            <p className="font-body-md text-on-surface whitespace-pre-wrap">{ocr.ocrText}</p>
          ) : (
            <p className="font-caption text-on-surface-variant">{ocr?.message || 'No text extracted.'}</p>
          )}
        </div>
      ) : null}

      {objectRows.length > 0 || objects.length > 0 || objectStatus === 'unavailable' ? (
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-md py-md space-y-sm">
          <p className="font-label-sm text-on-surface">
            Object detection · {analyze?.objectDetection?.model || 'object_v1'}
          </p>
          {objectRows.length > 0 || objects.length > 0 ? (
            <div className="space-y-sm">
              {(objectRows.length ? objectRows : objects).map((det, index) => (
                <DetectionRow
                  key={`${det.key || det.className}-${index}`}
                  detection={{
                    className: det.key || det.className,
                    confidence: det.confidence,
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="font-caption text-on-surface-variant">
              {analyze?.objectDetection?.message || 'Object model not configured yet.'}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use AiExtractionPanel — kept for imports during migration */
export function OcrResultsPanel({ ocrResult, isLoading, error }) {
  return (
    <AiExtractionPanel
      analyze={ocrResult ? { ocr: ocrResult, objectDetection: { detectedObjects: [] } } : null}
      isLoading={isLoading}
      error={error}
    />
  );
}
