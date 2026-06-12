/**
 * Resolve user vs AI category fields for item create and matching.
 */

const { resolveSuggestedCategory, getOcrCategoryConfidence } = require('./categoryMapping');

const REPORT_CATEGORIES = ['Electronics', 'Clothing', 'Documents', 'Accessories', 'Other'];

/** Minimum object_v1 detection confidence to trust aiCategory for effectiveCategory. */
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
  if (!normalizedUser) {
    throw new Error('Invalid user category');
  }

  const aiCategory = resolveAiCategory(detectedObjects, aiResponse);
  const categoryDetectionConfidence = resolveCategoryDetectionConfidence(
    detectedObjects,
    aiResponse,
  );
  const categoryMismatch = Boolean(aiCategory && aiCategory !== normalizedUser);

  let effectiveCategory = normalizedUser;
  if (
    aiCategory &&
    categoryDetectionConfidence >= AI_CATEGORY_CONFIDENCE_THRESHOLD
  ) {
    effectiveCategory = aiCategory;
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
 * Effective category for legacy documents without new fields.
 *
 * @param {object} doc MongoDB item document
 */
function getEffectiveCategoryFromDoc(doc) {
  if (!doc || typeof doc !== 'object') return null;
  if (doc.effectiveCategory) return normalizeCategory(doc.effectiveCategory);
  const aiCat = doc.aiCategory || doc.aiMetadata?.suggestedCategory;
  if (aiCat && normalizeCategory(aiCat)) {
    return normalizeCategory(aiCat);
  }
  return normalizeCategory(doc.category);
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
};
