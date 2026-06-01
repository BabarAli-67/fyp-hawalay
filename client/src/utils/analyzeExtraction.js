/**
 * Model-agnostic helpers for analyze-image extraction (OCR, object_v1, future models).
 */

export function humanizeKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @param {Array<{ source?: string, key?: string, label?: string, value?: string | null, confidence?: number, bbox?: number[] }>} attributes
 */
export function normalizeExtractedAttributes(attributes) {
  if (!Array.isArray(attributes)) return [];

  return attributes
    .map((row) => ({
      source: row.source || 'unknown',
      key: row.key || '',
      label: row.label || humanizeKey(row.key),
      value: row.value ?? null,
      confidence: Number(row.confidence ?? 0),
      bbox: Array.isArray(row.bbox) ? row.bbox : null,
    }))
    .filter((row) => row.key);
}

/**
 * Prefer structured attributes; fall back to legacy OCR field map.
 * @param {object} analyze Normalized analyze snapshot
 */
export function getExtractionRows(analyze) {
  if (!analyze) return [];

  if (analyze.extractedAttributes?.length) {
    return analyze.extractedAttributes.filter((r) => r.value || r.confidence > 0);
  }

  const rows = [];
  const ocrFields = analyze.ocr?.documentFields || [];
  for (const field of ocrFields) {
    if (!field?.key) continue;
    rows.push({
      source: 'card_ocr_v1',
      key: field.key,
      label: field.label || humanizeKey(field.key),
      value: field.value ?? null,
      confidence: Number(field.confidence ?? 0),
      bbox: field.bbox ?? null,
    });
  }

  for (const det of analyze.objectDetection?.detectedObjects || []) {
    rows.push({
      source: analyze.objectDetection?.model || 'object_v1',
      key: det.className,
      label: humanizeKey(det.className),
      value: null,
      confidence: Number(det.confidence ?? 0),
      bbox: det.bbox ?? null,
    });
  }

  return rows;
}

/**
 * @param {object} analyze
 * @returns {string | null}
 */
export function pickBrandFromAnalyze(analyze) {
  if (!analyze) return null;

  const brandRow = getExtractionRows(analyze).find(
    (r) => /brand/i.test(r.key) && r.value,
  );
  if (brandRow?.value) return brandRow.value;

  return analyze.ocr?.fields?.cardBrand?.value || null;
}

export function formatFeaturePoints(points) {
  if (!Array.isArray(points) || !points.length) return '';
  return points.map((p) => (p.startsWith('•') ? p : `• ${p}`)).join('\n');
}

export function resolveAiDistinctiveFeatures(analyze) {
  if (!analyze) return '';
  if (analyze.distinctiveFeatures?.trim()) {
    return analyze.distinctiveFeatures.trim();
  }
  return formatFeaturePoints(analyze.featurePoints);
}
