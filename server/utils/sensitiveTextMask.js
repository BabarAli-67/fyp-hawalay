/**
 * Phase 4 — mask sensitive numeric text in public item fields before MongoDB save.
 *
 * Embeddings are resolved before this runs so matching fingerprints keep original text.
 */

const SENSITIVE_OCR_VALUE_KEYS = new Set([
  'card_number',
  'expiry_date',
  'cardholder_name',
  'card_brand',
  'ocr_text',
]);

const CNIC_PATTERN = /\b(\d{5})[-\s]?(\d{7})[-\s]?(\d)\b/g;
const CARD_DIGIT_RUN = /\b(?:\d[ \-]?){12,18}\d\b/g;
/** Digit groups (1–7 chars) separated by whitespace — EasyOCR card PAN layout. */
const FRAGMENTED_DIGIT_GROUPS = /\b\d{1,7}(?:[ \t\n\r]+\d{1,7}){2,7}\b/g;
const EXPIRY_PATTERN = /\b(\d{2})[/\-](\d{2,4})\b/g;
const CVC_LABEL_PATTERN = /\b(cvv|cvc|security code)\s*[:#-]?\s*(\d{3,4})\b/gi;

/**
 * @param {string} digits
 * @returns {string}
 */
function maskDigitSequence(digits) {
  const normalized = String(digits).replace(/\D/g, '');
  if (normalized.length <= 3) return normalized;
  return `${'*'.repeat(normalized.length - 3)}${normalized.slice(-3)}`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function maskCardNumberValue(value) {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 13) {
    return maskDigitSequence(digits);
  }
  return maskDigitSequence(digits);
}

/**
 * @param {string} value
 * @returns {string}
 */
function maskCnicValue(value) {
  const match = String(value).match(/^(\d{5})[-\s]?(\d{7})[-\s]?(\d)$/);
  if (match) {
    return `*****-*******-${match[3]}`;
  }
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 13) {
    return `*****-*******-${digits.slice(-1)}`;
  }
  return maskCardNumberValue(value);
}

/**
 * @param {string} value
 * @returns {string}
 */
function maskExpiryValue(value) {
  return String(value).replace(EXPIRY_PATTERN, '**/**');
}

/**
 * True when whitespace-separated groups match Pakistan CNIC layout (5 + 7 + 1).
 * @param {string} match
 */
function isCnicFragmentedGroups(match) {
  const parts = String(match)
    .trim()
    .split(/[ \t\n\r]+/)
    .filter(Boolean);
  return parts.length === 3 && parts[0].length === 5 && parts[1].length === 7 && parts[2].length === 1;
}

/**
 * Mask PAN-style numbers split across EasyOCR word boxes (spaces / line breaks).
 * @param {string} text
 */
function maskFragmentedCardNumbers(text) {
  return String(text).replace(FRAGMENTED_DIGIT_GROUPS, (match) => {
    if (isCnicFragmentedGroups(match)) {
      return match;
    }
    const digits = match.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) {
      return match;
    }
    return maskCardNumberValue(digits);
  });
}

/**
 * @param {string} value
 * @returns {string}
 */
function maskRegionValue(region) {
  const field = String(region?.field || '').trim();
  const text = String(region?.text || '').trim();
  if (!text) return text;

  if (field === 'card_number') {
    const docLabel = String(region?.label || '').toLowerCase();
    if (docLabel.includes('cnic') || CNIC_PATTERN.test(text)) {
      return maskCnicValue(text);
    }
    return maskCardNumberValue(text);
  }
  if (field === 'expiry_date') {
    return maskExpiryValue(text);
  }
  if (field === 'cvc') {
    const digits = text.replace(/\D/g, '');
    return '*'.repeat(Math.max(digits.length, 3));
  }
  return maskSensitiveText(text);
}

/**
 * @param {string | null | undefined} text
 * @param {{ regions?: Array<object> }} [options]
 * @returns {string | undefined}
 */
function maskSensitiveText(text, options = {}) {
  if (text == null) return text;
  const input = String(text);
  if (!input.trim()) return input;

  let output = input;
  const regions = Array.isArray(options.regions) ? options.regions : [];

  for (const region of regions) {
    const original = String(region?.text || '').trim();
    if (!original || !output.includes(original)) continue;
    const masked = maskRegionValue(region);
    if (masked !== original) {
      output = output.split(original).join(masked);
    }
  }

  output = output.replace(CNIC_PATTERN, '*****-*******-$3');
  output = maskFragmentedCardNumbers(output);
  output = output.replace(CARD_DIGIT_RUN, (match) => maskCardNumberValue(match));
  output = output.replace(EXPIRY_PATTERN, '**/**');
  output = output.replace(CVC_LABEL_PATTERN, (_match, label, digits) => `${label} ${'*'.repeat(digits.length)}`);

  return output;
}

/**
 * @param {unknown} value
 * @param {{ regions?: Array<object> }} options
 * @returns {unknown}
 */
function maskStructuredValue(value, options) {
  if (typeof value === 'string') {
    return maskSensitiveText(value, options);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => maskStructuredValue(entry, options));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const next = { ...value };
  if (typeof next.value === 'string') {
    next.value = maskSensitiveText(next.value, options);
  }
  if (typeof next.text === 'string') {
    next.text = maskSensitiveText(next.text, options);
  }
  return next;
}

/**
 * @param {object | null | undefined} ocrFields
 * @param {{ regions?: Array<object> }} [options]
 * @returns {object | null | undefined}
 */
function maskOcrFields(ocrFields, options = {}) {
  if (!ocrFields || typeof ocrFields !== 'object') return ocrFields;

  const masked = { ...ocrFields };

  for (const key of SENSITIVE_OCR_VALUE_KEYS) {
    if (masked[key] != null) {
      masked[key] = maskSensitiveText(String(masked[key]), options);
    }
  }

  if (masked.fields && typeof masked.fields === 'object') {
    const fields = { ...masked.fields };
    for (const [key, entry] of Object.entries(fields)) {
      if (SENSITIVE_OCR_VALUE_KEYS.has(key) || key === 'cvc') {
        fields[key] = maskStructuredValue(entry, options);
      }
    }
    masked.fields = fields;
  }

  if (typeof masked.ocr_text === 'string') {
    masked.ocr_text = maskSensitiveText(masked.ocr_text, options);
  }
  if (typeof masked.ocrText === 'string') {
    masked.ocrText = maskSensitiveText(masked.ocrText, options);
  }

  if (Array.isArray(masked.detections)) {
    masked.detections = masked.detections.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const className = String(row.class_name || row.className || '').trim();
      if (!SENSITIVE_OCR_VALUE_KEYS.has(className) && className !== 'cvc') {
        return row;
      }
      return {
        ...row,
        text: row.text != null ? maskSensitiveText(String(row.text), options) : row.text,
      };
    });
  }

  return masked;
}

/**
 * Mask public text fields on an item payload before persistence.
 *
 * @param {object} itemPayload
 * @param {object} aiMetadata
 * @param {{ isSensitive: boolean, sensitiveRegions?: Array<object> }} context
 * @returns {{ itemPayload: object, aiMetadata: object }}
 */
function applyPublicTextPrivacy(itemPayload, aiMetadata, context) {
  if (!context?.isSensitive) {
    return { itemPayload, aiMetadata };
  }

  const options = { regions: context.sensitiveRegions || aiMetadata?.sensitiveRegions || [] };
  const mask = (value) =>
    value != null && String(value).trim() ? maskSensitiveText(String(value), options) : value;

  const nextPayload = { ...itemPayload };
  nextPayload.title = mask(nextPayload.title);
  nextPayload.description = mask(nextPayload.description);
  nextPayload.caption = mask(nextPayload.caption);
  nextPayload.ocrText = mask(nextPayload.ocrText);
  nextPayload.distinctiveFeatures = mask(nextPayload.distinctiveFeatures);

  const nextMetadata = { ...aiMetadata };
  if (nextMetadata.ocrFields) {
    nextMetadata.ocrFields = maskOcrFields(nextMetadata.ocrFields, options);
  }
  nextMetadata.textPrivacyMasked = true;

  return { itemPayload: nextPayload, aiMetadata: nextMetadata };
}

const SENSITIVE_EXTRACTED_ATTR_KEY = /card_number|expiry|cvc|cvv|pan|cnic|national.?id/i;

/**
 * @param {Array<object> | null | undefined} attributes
 * @param {{ regions?: Array<object> }} options
 */
function maskExtractedAttributes(attributes, options = {}) {
  if (!Array.isArray(attributes)) return attributes;
  return attributes.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const key = String(row.key || row.label || '').toLowerCase();
    if (row.value == null || row.value === '') return row;
    const value = String(row.value);
    const shouldMask =
      SENSITIVE_EXTRACTED_ATTR_KEY.test(key) || value !== maskSensitiveText(value, options);
    if (!shouldMask) return row;
    return {
      ...row,
      value: maskSensitiveText(value, options),
    };
  });
}

/**
 * @param {object | null | undefined} suggested
 * @param {{ regions?: Array<object> }} options
 */
function maskSuggestedFields(suggested, options = {}) {
  if (!suggested || typeof suggested !== 'object') return suggested;
  const next = { ...suggested };
  for (const key of [
    'suggested_title',
    'suggestedTitle',
    'suggested_description',
    'suggestedDescription',
    'suggested_distinctive_features',
    'suggestedDistinctiveFeatures',
  ]) {
    if (typeof next[key] === 'string' && next[key].trim()) {
      next[key] = maskSensitiveText(next[key], options);
    }
  }
  return next;
}

/**
 * Mask sensitive numeric text in an analyze-image payload for client autofill/UI.
 * Does not mutate the input object.
 *
 * @param {object} payload Unmasked analyze response from FastAPI
 * @param {{ sensitiveRegions?: Array<object> }} [context]
 * @returns {object}
 */
function maskAnalyzePayloadForClient(payload, context = {}) {
  if (!payload || typeof payload !== 'object') return payload;

  const options = { regions: context.sensitiveRegions || [] };
  const next = { ...payload };

  if (next.ocr && typeof next.ocr === 'object') {
    const ocr = maskOcrFields({ ...next.ocr }, options);
    if (ocr.suggested) {
      ocr.suggested = maskSuggestedFields(ocr.suggested, options);
    }
    next.ocr = ocr;
  }

  for (const key of ['ocr_text', 'ocrText']) {
    if (typeof next[key] === 'string' && next[key].trim()) {
      next[key] = maskSensitiveText(next[key], options);
    }
  }

  if (typeof next.caption === 'string' && next.caption.trim()) {
    next.caption = maskSensitiveText(next.caption, options);
  }

  for (const key of ['distinctive_features', 'distinctiveFeatures']) {
    if (typeof next[key] === 'string' && next[key].trim()) {
      next[key] = maskSensitiveText(next[key], options);
    }
  }

  if (Array.isArray(next.feature_points)) {
    next.feature_points = next.feature_points.map((point) =>
      point != null ? maskSensitiveText(String(point), options) : point,
    );
  }
  if (Array.isArray(next.featurePoints)) {
    next.featurePoints = next.featurePoints.map((point) =>
      point != null ? maskSensitiveText(String(point), options) : point,
    );
  }

  for (const key of ['extracted_attributes', 'extractedAttributes']) {
    if (Array.isArray(next[key])) {
      next[key] = maskExtractedAttributes(next[key], options);
    }
  }

  return next;
}

module.exports = {
  applyPublicTextPrivacy,
  maskAnalyzePayloadForClient,
  maskSensitiveText,
  maskOcrFields,
  maskCardNumberValue,
  maskCnicValue,
  maskFragmentedCardNumbers,
};
