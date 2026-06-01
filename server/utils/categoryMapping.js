/**
 * Map detector class names to report categories (placeholder until object model ships).
 *
 * Populate CLASS_TO_CATEGORY when the 21-class model is trained.
 * Keep REPORT_CATEGORIES in sync with server/models/Item.js.
 */

const REPORT_CATEGORIES = ['Electronics', 'Clothing', 'Documents', 'Accessories', 'Other'];

/** @type {Record<string, string>} class name → report category */
const CLASS_TO_CATEGORY = {};

/**
 * Suggest a report category from object detections (highest confidence wins).
 * Returns null when mapping is empty or there are no detections.
 *
 * @param {Array<{ className?: string, confidence?: number }>} detectedObjects
 * @returns {string | null}
 */
function suggestCategoryFromDetections(detectedObjects) {
  if (!detectedObjects?.length || Object.keys(CLASS_TO_CATEGORY).length === 0) {
    return null;
  }

  const best = detectedObjects.reduce((top, item) => {
    const conf = Number(item?.confidence ?? 0);
    if (!top || conf > top.confidence) {
      return { className: item?.className || '', confidence: conf };
    }
    return top;
  }, null);

  if (!best?.className) return null;

  const suggested = CLASS_TO_CATEGORY[best.className];
  return REPORT_CATEGORIES.includes(suggested) ? suggested : null;
}

module.exports = {
  REPORT_CATEGORIES,
  CLASS_TO_CATEGORY,
  suggestCategoryFromDetections,
};
