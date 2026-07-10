/**
 * Resolve user vs AI category fields for item create and matching.
 */

const { resolveSuggestedCategory, getOcrCategoryConfidence } = require('./categoryMapping');

const REPORT_CATEGORIES = ['Electronics', 'Clothing', 'Documents', 'Accessories', 'Other'];

/** Minimum object_v1 detection confidence (retained for metadata / auditing). */
const AI_CATEGORY_CONFIDENCE_THRESHOLD = Number(
  process.env.AI_CATEGORY_CONFIDENCE_THRESHOLD || 0.55,
);

const CATEGORY_BONUS_SAME = 0.1;

function normalizeCategory(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  return REPORT_CATEGORIES.includes(text) ? text : null;
}

/**
 * Highest confidence among detected objects (for effectiveCategory gating).
 *
 * @param {Array<{ className?: string, confidence?: number }>} detectedObjects
 */
function getBestDetectionConfidence(detectedObjects) {
  if (!Array.isArray(detectedObjects) || !detectedObjects.length) {
    return 0;
  }
  return detectedObjects.reduce((max, row) => {
    const conf = Number(row?.confidence ?? 0);
    return Number.isFinite(conf) && conf > max ? conf : max;
  }, 0);
}

/**
 * Resolve aiCategory from OCR, object detections, or analyze payload metadata.
 *
 * @param {Array<{ className?: string, confidence?: number }>} detectedObjects
 * @param {object | null} aiResponse
 */
function resolveAiCategory(detectedObjects, aiResponse) {
  const suggestion = resolveSuggestedCategory({
    detectedObjects,
    analyzePayload: aiResponse,
    ocr: aiResponse?.ocr,
  });
  if (suggestion?.category) {
    return normalizeCategory(suggestion.category);
  }

  const meta = aiResponse?.aiMetadata || aiResponse;
  const suggested =
    meta?.suggestedCategory ??
    aiResponse?.suggestedCategory ??
    aiResponse?.suggested_category ??
    null;
  return normalizeCategory(suggested);
}

/**
 * Confidence gating for effectiveCategory (OCR vs object_v1).
 *
 * @param {Array<{ className?: string, confidence?: number }>} detectedObjects
 * @param {object | null} aiResponse
 */
function resolveCategoryDetectionConfidence(detectedObjects, aiResponse) {
  const suggestion = resolveSuggestedCategory({
    detectedObjects,
    analyzePayload: aiResponse,
    ocr: aiResponse?.ocr,
  });
  if (suggestion?.source === 'card_ocr_v1') {
    return suggestion.confidence || getOcrCategoryConfidence(aiResponse?.ocr);
  }
  if (suggestion?.source === 'object_v1') {
    return suggestion.confidence || getBestDetectionConfidence(detectedObjects);
  }
  return getBestDetectionConfidence(detectedObjects);
}

/**
 * Compute category fields for a new or updated item.
 *
 * @param {{
 *   userCategory: string,
 *   detectedObjects?: Array<{ className?: string, confidence?: number }>,
 *   aiResponse?: object | null,
 * }} params
 */
function resolveCategoryFields({ userCategory, detectedObjects = [], aiResponse = null }) {
  const normalizedUser = normalizeCategory(userCategory);
  const aiCategory = resolveAiCategory(detectedObjects, aiResponse);
  const categoryDetectionConfidence = resolveCategoryDetectionConfidence(
    detectedObjects,
    aiResponse,
  );
  const categoryMismatch = Boolean(
    normalizedUser && aiCategory && aiCategory !== normalizedUser,
  );

  let effectiveCategory;
  if (normalizedUser) {
    // Rule 1: explicit user selection is always final
    effectiveCategory = normalizedUser;
  } else if (aiCategory) {
    // Rule 2: no user selection — use AI prediction when available
    effectiveCategory = aiCategory;
  } else {
    // Rule 3: existing fallback when neither is available
    throw new Error('Invalid user category');
  }

  return {
    userCategory: normalizedUser,
    aiCategory: aiCategory || null,
    effectiveCategory,
    categoryMismatch,
    categoryDetectionConfidence: categoryDetectionConfidence || null,
    /** Backward-compatible browse/filter field — mirrors effectiveCategory. */
    category: effectiveCategory,
  };
}

/**
 * Effective category for legacy documents and API display.
 * User selection wins when stored; AI only when user category is absent.
 *
 * @param {object} doc MongoDB item document
 */
function getEffectiveCategoryFromDoc(doc) {
  if (!doc || typeof doc !== 'object') return null;

  const userCat = normalizeCategory(doc.userCategory);
  if (userCat) return userCat;

  const aiCat = getAiCategoryFromDoc(doc);
  if (aiCat) return aiCat;

  return normalizeCategory(doc.effectiveCategory) || normalizeCategory(doc.category);
}

/**
 * Apply resolved display category on API responses (fixes legacy mismatched rows).
 *
 * @param {object} doc MongoDB item document or lean object
 */
function applyResolvedCategoryToItem(doc) {
  if (!doc || typeof doc !== 'object') return doc;

  const resolved = getEffectiveCategoryFromDoc(doc);
  if (!resolved) return doc;

  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    ...plain,
    category: resolved,
    effectiveCategory: resolved,
  };
}

function getUserCategoryFromDoc(doc) {
  if (!doc || typeof doc !== 'object') return null;
  return normalizeCategory(doc.userCategory) || normalizeCategory(doc.category);
}

function getAiCategoryFromDoc(doc) {
  if (!doc || typeof doc !== 'object') return null;
  return (
    normalizeCategory(doc.aiCategory) ||
    normalizeCategory(doc.aiMetadata?.suggestedCategory)
  );
}

module.exports = {
  AI_CATEGORY_CONFIDENCE_THRESHOLD,
  CATEGORY_BONUS_SAME,
  REPORT_CATEGORIES,
  resolveCategoryFields,
  resolveAiCategory,
  resolveCategoryDetectionConfidence,
  getBestDetectionConfidence,
  getEffectiveCategoryFromDoc,
  getUserCategoryFromDoc,
  getAiCategoryFromDoc,
  applyResolvedCategoryToItem,
};
