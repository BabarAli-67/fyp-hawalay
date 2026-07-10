/**
 * Sensitive OCR region helpers (Phase 2) — server-side only.
 */

function normalizeRegion(region) {
  if (!region || typeof region !== 'object') return null;

  const text = region.text != null ? String(region.text).trim() : '';
  if (!text) return null;

  const rawBoxes = region.boundingBoxes || region.bounding_boxes || [];
  const boundingBoxes = Array.isArray(rawBoxes)
    ? rawBoxes
        .filter((box) => Array.isArray(box) && box.length === 4)
        .map((box) => box.map((n) => Math.round(Number(n))))
    : [];

  if (boundingBoxes.length === 0) return null;

  const confidence = Number(region.confidence ?? 0);
  return {
    field: String(region.field || '').trim() || 'unknown',
    label: String(region.label || '').trim() || 'Sensitive Value',
    text,
    boundingBoxes,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(confidence, 1)) : 0,
  };
}

/**
 * @param {object | null | undefined} analyzePayload
 * @returns {Array<object>}
 */
function extractSensitiveRegions(analyzePayload) {
  if (!analyzePayload || typeof analyzePayload !== 'object') return [];

  const fromOcr = analyzePayload.ocr?.sensitive_regions || analyzePayload.ocr?.sensitiveRegions;
  const fromRoot = analyzePayload.sensitive_regions || analyzePayload.sensitiveRegions;
  const raw = Array.isArray(fromOcr) ? fromOcr : Array.isArray(fromRoot) ? fromRoot : [];

  return raw.map(normalizeRegion).filter(Boolean);
}

/**
 * Remove sensitive OCR regions before sending analyze results to the client.
 * @param {object} payload
 * @returns {object}
 */
function stripSensitiveRegionsFromAnalyzePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  const next = { ...payload };
  delete next.sensitive_regions;
  delete next.sensitiveRegions;

  if (next.ocr && typeof next.ocr === 'object') {
    const ocr = { ...next.ocr };
    delete ocr.sensitive_regions;
    delete ocr.sensitiveRegions;
    next.ocr = ocr;
  }

  return next;
}

/**
 * Remove server-only masking metadata from item API responses.
 * @param {object} item
 * @returns {object}
 */
function stripSensitiveMetadataFromItem(item) {
  if (!item || typeof item !== 'object') return item;

  const row = item.toObject ? item.toObject() : { ...item };
  if (row.aiMetadata && typeof row.aiMetadata === 'object') {
    const aiMetadata = { ...row.aiMetadata };
    delete aiMetadata.sensitiveRegions;
    row.aiMetadata = aiMetadata;
  }
  return row;
}

/**
 * Derive coarse mask regions from legacy OCR fields/detections when Phase 2
 * sensitive_regions are unavailable (e.g. stash expired, degraded OCR).
 *
 * @param {object | null | undefined} analyzePayload
 * @returns {Array<object>}
 */
function buildFallbackMaskRegionsFromAnalyze(analyzePayload) {
  if (!analyzePayload || typeof analyzePayload !== 'object') return [];

  const ocr = analyzePayload.ocr;
  if (!ocr || typeof ocr !== 'object') return [];

  const collected = [];

  const fields = ocr.fields;
  if (fields && typeof fields === 'object') {
    for (const [fieldName, entry] of Object.entries(fields)) {
      const bbox = entry?.bbox;
      if (Array.isArray(bbox) && bbox.length === 4) {
        collected.push({ field: fieldName, box: bbox.map((n) => Math.round(Number(n))) });
      }
    }
  }

  if (Array.isArray(ocr.detections)) {
    for (const det of ocr.detections) {
      const bbox = det?.bbox;
      const className = String(det?.class_name || det?.className || 'detection').trim();
      if (Array.isArray(bbox) && bbox.length === 4) {
        collected.push({ field: className, box: bbox.map((n) => Math.round(Number(n))) });
      }
    }
  }

  if (!collected.length) return [];

  const boundary = collected.find((item) => item.field === 'card_boundary');
  if (boundary) {
    return [
      {
        field: 'document',
        label: 'Document',
        text: '',
        boundingBoxes: [boundary.box],
        confidence: 0.5,
      },
    ];
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of collected) {
    const [x1, y1, x2, y2] = item.box;
    minX = Math.min(minX, x1, x2);
    minY = Math.min(minY, y1, y2);
    maxX = Math.max(maxX, x1, x2);
    maxY = Math.max(maxY, y1, y2);
  }

  if (!Number.isFinite(minX)) return [];

  return [
    {
      field: 'document',
      label: 'Document',
      text: '',
      boundingBoxes: [[minX, minY, maxX, maxY]],
      confidence: 0.4,
    },
  ];
}

module.exports = {
  extractSensitiveRegions,
  normalizeRegion,
  stripSensitiveRegionsFromAnalyzePayload,
  stripSensitiveMetadataFromItem,
  buildFallbackMaskRegionsFromAnalyze,
};
