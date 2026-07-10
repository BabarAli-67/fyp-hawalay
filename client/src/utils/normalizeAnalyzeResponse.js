/**
 * Normalize FastAPI analyze-image response for scalable UI + persistence.
 */

import { formatConfidence } from './normalizeOcrResponse.js';
import { humanizeKey as humanizeFieldKey, normalizeExtractedAttributes } from './analyzeExtraction.js';

/** Optional display labels for known OCR keys; unknown keys are humanized automatically. */
const DOCUMENT_FIELD_LABELS = {
  card_number: 'Card number',
  cardholder_name: 'Cardholder name',
  expiry_date: 'Expiry date',
  card_brand: 'Card brand',
  card_boundary: 'Card boundary',
};

function labelForFieldKey(key) {
  return DOCUMENT_FIELD_LABELS[key] || humanizeFieldKey(key);
}

function pickField(fields, key) {
  const entry = fields?.[key];
  if (!entry) return null;
  return {
    value: entry.value ?? null,
    confidence: Number(entry.confidence ?? 0),
    ocrConfidence: entry.ocr_confidence ?? entry.ocrConfidence ?? null,
    detectionConfidence: entry.detection_confidence ?? entry.detectionConfidence ?? null,
    bbox: entry.bbox ?? null,
  };
}

function normalizeOcrBlock(ocr) {
  if (!ocr || typeof ocr !== 'object') {
    return null;
  }

  const fields = ocr.fields || {};
  const documentFields = Object.keys(fields).map((key) => ({
    key,
    label: labelForFieldKey(key),
    ...pickField(fields, key),
  }));

  const legacyFields = {
    cardBrand: pickField(fields, 'card_brand'),
    cardNumber: pickField(fields, 'card_number'),
    cardholderName: pickField(fields, 'cardholder_name'),
    expiryDate: pickField(fields, 'expiry_date'),
  };

  return {
    success: Boolean(ocr.success),
    status: ocr.status || 'unknown',
    documentType: ocr.document_type || ocr.documentType || 'unknown',
    processingTimeMs: Number(ocr.processing_time_ms ?? ocr.processingTimeMs ?? 0),
    overallConfidence: Number(ocr.overall_confidence ?? ocr.overallConfidence ?? 0),
    ocrText: ocr.ocr_text || ocr.ocrText || '',
    message: ocr.message || null,
    yoloAvailable: Boolean(ocr.yolo_available ?? ocr.yoloAvailable),
    detectionCount: Number(ocr.detection_count ?? ocr.detectionCount ?? 0),
    fields: legacyFields,
    documentFields,
    suggested: ocr.suggested || null,
  };
}

function normalizeObjectDetection(block) {
  if (!block || typeof block !== 'object') {
    return {
      model: 'object_v1',
      status: 'skipped',
      ready: false,
      detectedObjects: [],
      message: null,
      processingTimeMs: 0,
    };
  }

  const rawList = block.detected_objects || block.detectedObjects || [];
  const detectedObjects = Array.isArray(rawList)
    ? rawList.map((item) => ({
        className: item.class_name || item.className || 'unknown',
        confidence: Number(item.confidence ?? 0),
        bbox: Array.isArray(item.bbox) ? item.bbox : [],
      }))
    : [];

  return {
    model: block.model || 'object_v1',
    version: block.version || '',
    status: block.status || 'skipped',
    ready: Boolean(block.ready),
    message: block.message || null,
    detectedObjects,
    processingTimeMs: Number(block.processing_time_ms ?? block.processingTimeMs ?? 0),
  };
}

function normalizeSuggestedCategory(raw) {
  if (raw == null || raw === '') return null;
  const text = String(raw).trim();
  return text || null;
}

const TRAILING_FRAGMENT_RE =
  /\b(featuring|showing|with|including|containing|displaying|having|centered|located)\s+(a|an|the|on|in|at)?\s*$/i;

function endsWithSentencePunctuation(text) {
  return /[.!?]["')]*\s*$/.test(text);
}

/**
 * Drop a dangling final clause when Gemini stops mid-sentence.
 * Mirrors ai-server/utils/report_caption.repair_incomplete_caption (lightweight).
 */
function sanitizeTruncatedCaption(caption) {
  const text = String(caption || '').trim();
  if (!text || endsWithSentencePunctuation(text)) return text;
  if (!TRAILING_FRAGMENT_RE.test(text) && !/[,;:]\s*$/.test(text)) return text;

  const commaIdx = text.lastIndexOf(',');
  if (commaIdx > 20) {
    const head = text.slice(0, commaIdx).trim();
    if (head.length >= 40 && !TRAILING_FRAGMENT_RE.test(head)) {
      return endsWithSentencePunctuation(head) ? head : `${head}.`;
    }
  }

  for (const marker of [' featuring ', ' showing ', ' with ', ' including ', ' containing ']) {
    const idx = text.toLowerCase().lastIndexOf(marker);
    if (idx > 20) {
      const head = text.slice(0, idx).trim();
      if (head.length >= 40) {
        return endsWithSentencePunctuation(head) ? head : `${head}.`;
      }
    }
  }

  return text;
}

/**
 * @param {object} data Raw analyze-image API response
 */
export function normalizeAnalyzeResponse(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const rawEmbedding =
    data.embedding_vector !== undefined ? data.embedding_vector : data.embeddingVector;

  let embeddingVector = null;
  let embeddingAvailable = false;
  if (rawEmbedding != null && Array.isArray(rawEmbedding)) {
    embeddingVector = rawEmbedding;
    embeddingAvailable = Boolean(data.embedding_available ?? data.embeddingAvailable);
  }

  const rawPoints = data.feature_points || data.featurePoints || [];
  const featurePoints = Array.isArray(rawPoints)
    ? rawPoints.map((p) => String(p).trim()).filter(Boolean)
    : [];
  const distinctiveFeatures =
    (data.distinctive_features || data.distinctiveFeatures || '').trim() ||
    (featurePoints.length
      ? featurePoints.map((p) => (p.startsWith('•') ? p : `• ${p}`)).join('\n')
      : '');

  const extractedAttributes = normalizeExtractedAttributes(
    data.extracted_attributes || data.extractedAttributes,
  );

  return {
    ocr: normalizeOcrBlock(data.ocr),
    objectDetection: normalizeObjectDetection(data.object_detection || data.objectDetection),
    extractedAttributes,
    caption: sanitizeTruncatedCaption((data.caption || '').trim()),
    distinctiveFeatures,
    featurePoints,
    ocrText: (data.ocr_text || data.ocrText || '').trim(),
    embeddingVector,
    embeddingAvailable,
    embeddingDimension: Number(data.embedding_dimension ?? data.embeddingDimension ?? 0),
    processingTimeMs: Number(data.processing_time_ms ?? data.processingTimeMs ?? 0),
    visionStatus: (data.vision_status || data.visionStatus || 'empty').trim(),
    visionMessage: (data.vision_message || data.visionMessage || '').trim(),
    suggestedCategory: normalizeSuggestedCategory(
      data.suggestedCategory ?? data.suggested_category,
    ),
    suggestedCategorySource: (data.suggestedCategorySource ?? data.suggested_category_source ?? '')
      .trim() || null,
    suggestedCategoryHint: (data.suggestedCategoryHint ?? data.suggested_category_hint ?? '').trim() || null,
    ocrDocumentType: (data.ocrDocumentType ?? data.ocr_document_type ?? '').trim() || null,
    models: data.models || {},
    raw: data,
  };
}

export { formatConfidence, normalizeOcrBlock };
