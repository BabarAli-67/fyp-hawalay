/**
 * Sensitive OCR region helpers (Phase 2) — server-side only.
 */

const PRECISE_MASK_FIELDS = new Set(['card_number', 'expiry_date', 'cvc']);

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

function isNationalIdAnalyze(analyzePayload) {
  if (!analyzePayload || typeof analyzePayload !== 'object') return false;
  const type = String(
    analyzePayload.sensitive_document_type ||
      analyzePayload.sensitiveDocumentType ||
      analyzePayload.ocr?.document_type ||
      analyzePayload.ocr?.documentType ||
      '',
  )
    .trim()
    .toLowerCase();
  return type === 'cnic' || type === 'national_id' || type === 'id_card';
}

/**
 * Derive coarse mask regions from legacy OCR fields/detections when Phase 2
 * sensitive_regions are unavailable (e.g. stash expired, degraded OCR).
 *
 * Prefers precise number/expiry/CVC boxes. Never uses card_boundary — that
 * whites out the whole ID/card when blurred.
 *
 * @param {object | null | undefined} analyzePayload
 * @returns {Array<object>}
 */
function buildFallbackMaskRegionsFromAnalyze(analyzePayload) {
  if (!analyzePayload || typeof analyzePayload !== 'object') return [];

  const ocr = analyzePayload.ocr;
  if (!ocr || typeof ocr !== 'object') return [];

  const collected = [];
  const nationalId = isNationalIdAnalyze(analyzePayload);

  const fields = ocr.fields;
  if (fields && typeof fields === 'object') {
    for (const [fieldName, entry] of Object.entries(fields)) {
      const bbox = entry?.bbox;
      if (Array.isArray(bbox) && bbox.length === 4) {
        collected.push({
          field: fieldName,
          text: entry?.value != null ? String(entry.value) : fieldName,
          box: bbox.map((n) => Math.round(Number(n))),
        });
      }
    }
  }

  if (Array.isArray(ocr.detections)) {
    for (const det of ocr.detections) {
      const bbox = det?.bbox;
      const className = String(det?.class_name || det?.className || 'detection').trim();
      if (Array.isArray(bbox) && bbox.length === 4) {
        collected.push({
          field: className,
          text: det?.text != null ? String(det.text) : className,
          box: bbox.map((n) => Math.round(Number(n))),
        });
      }
    }
  }

  if (!collected.length) return [];

  // ID cards: only the identification number — never expiry/DOB or boundary.
  const precise = collected.filter((item) => {
    if (!PRECISE_MASK_FIELDS.has(item.field)) return false;
    if (nationalId) return item.field === 'card_number';
    return true;
  });

  if (precise.length) {
    return precise.map((item) => ({
      field: item.field,
      label: item.field === 'card_number' && nationalId ? 'CNIC Number' : 'Sensitive Value',
      text: item.text || item.field,
      boundingBoxes: [item.box],
      confidence: 0.5,
    }));
  }

  // Do not fall back to card_boundary / union of all detections — that bleaches
  // half or all of an ID card. Leave empty so the caller can choose a safer path.
  return [];
}

module.exports = {
  extractSensitiveRegions,
  normalizeRegion,
  stripSensitiveRegionsFromAnalyzePayload,
  stripSensitiveMetadataFromItem,
  buildFallbackMaskRegionsFromAnalyze,
};
