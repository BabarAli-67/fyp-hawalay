import { formatConfidence } from '../../utils/normalizeOcrResponse.js';

const FIELD_LABELS = {
  cardNumber: 'Card number',
  cardholderName: 'Cardholder name',
  expiryDate: 'Expiry date',
  cardBrand: 'Card brand',
};

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
      {(field.detectionConfidence != null || field.ocrConfidence != null) && (
        <p className="mt-xs font-caption text-on-surface-variant">
          {field.detectionConfidence != null
            ? `Detection ${formatConfidence(field.detectionConfidence)}`
            : null}
          {field.detectionConfidence != null && field.ocrConfidence != null ? ' · ' : null}
          {field.ocrConfidence != null ? `OCR ${formatConfidence(field.ocrConfidence)}` : null}
        </p>
      )}
    </div>
  );
}

/**
 * Structured OCR results from YOLO + EasyOCR pipeline.
 */
export function OcrResultsPanel({ ocrResult, isLoading, error }) {
  if (isLoading) {
    return (
      <div
        className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-md py-md"
        role="status"
      >
        <p className="font-label-sm text-on-surface flex items-center gap-xs">
          <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          Running document OCR…
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

  if (!ocrResult) {
    return null;
  }

  const hasValues = Object.values(ocrResult.fields || {}).some((f) => f?.value);

  return (
    <div
      className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-md py-md space-y-sm"
      role="region"
      aria-label="OCR extraction results"
    >
      <div className="flex items-center justify-between gap-sm">
        <p className="font-label-sm text-on-surface">
          OCR · {ocrResult.documentType.replace(/_/g, ' ')}
        </p>
        <span className="font-caption text-on-surface-variant">
          {ocrResult.processingTimeMs > 0 ? `${Math.round(ocrResult.processingTimeMs)} ms` : null}
          {ocrResult.overallConfidence > 0
            ? ` · ${formatConfidence(ocrResult.overallConfidence)} overall`
            : null}
        </span>
      </div>

      {ocrResult.message && !hasValues ? (
        <p className="font-caption text-on-surface-variant">{ocrResult.message}</p>
      ) : null}

      {hasValues ? (
        <div className="space-y-sm">
          <FieldRow label={FIELD_LABELS.cardNumber} field={ocrResult.fields.cardNumber} />
          <FieldRow label={FIELD_LABELS.cardholderName} field={ocrResult.fields.cardholderName} />
          <FieldRow label={FIELD_LABELS.expiryDate} field={ocrResult.fields.expiryDate} />
          <FieldRow label={FIELD_LABELS.cardBrand} field={ocrResult.fields.cardBrand} />
        </div>
      ) : ocrResult.ocrText ? (
        <p className="font-body-md text-on-surface whitespace-pre-wrap">{ocrResult.ocrText}</p>
      ) : (
        <p className="font-caption text-on-surface-variant">No text extracted from this image.</p>
      )}
    </div>
  );
}
