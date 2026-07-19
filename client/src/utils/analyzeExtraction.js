/**
 * Model-agnostic helpers for analyze-image extraction (OCR, object_v1, future models).
 */

import { BRAND_SUGGESTIONS } from '../components/report/reportFormConstants.js';

const EXTENDED_KNOWN_BRANDS = [
  'Habib Bank Limited',
  'MasterCard',
  'Mastercard',
  'American Express',
  'OnePlus',
  'Microsoft',
  'Google',
  'Huawei',
  'Xiaomi',
  'Canon',
  'Nikon',
  'LG',
  'Asus',
  'Acer',
  'MSI',
  'Razer',
  'Logitech',
  'JBL',
  'Bose',
  'Puma',
  'Reebok',
  'HBL',
  'UBL',
  'MCB',
  'Visa',
  'Nike',
  'Adidas',
];

/** Payment networks only — used for card uploads (never consumer brands like Apple). */
const PAYMENT_CARD_BRAND_RULES = [
  { pattern: /\bamerican\s+express\b/i, brand: 'American Express' },
  { pattern: /\bmaster\s*card\b/i, brand: 'Mastercard' },
  { pattern: /\bdiners\s+club\b/i, brand: 'Diners Club' },
  { pattern: /\bunion\s*pay\b/i, brand: 'UnionPay' },
  { pattern: /\bunionpay\b/i, brand: 'UnionPay' },
  { pattern: /\bdiscover\b/i, brand: 'Discover' },
  { pattern: /\bvisa\b/i, brand: 'Visa' },
  { pattern: /\bamex\b/i, brand: 'American Express' },
];

/** Longest match first — e.g. "Habib Bank Limited" before "HBL". */
const KNOWN_BRANDS = [...new Set([...BRAND_SUGGESTIONS, ...EXTENDED_KNOWN_BRANDS])].sort(
  (a, b) => b.length - a.length,
);

const PRODUCT_LINE_BRANDS = [
  { pattern: /\biPhone\b/i, brand: 'Apple' },
  { pattern: /\biPad\b/i, brand: 'Apple' },
  { pattern: /\bMacBook\b/i, brand: 'Apple' },
  { pattern: /\bAirPods\b/i, brand: 'Apple' },
  { pattern: /\bGalaxy\b/i, brand: 'Samsung' },
  { pattern: /\bThinkPad\b/i, brand: 'Lenovo' },
  { pattern: /\bXPS\b/i, brand: 'Dell' },
  { pattern: /\bPixel\b/i, brand: 'Google' },
];

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeBrandText(value) {
  const text = String(value ?? '').trim();
  if (!text || text.length > 100) return null;
  return text;
}

function canonicalizeKnownBrand(value) {
  const text = normalizeBrandText(value);
  if (!text) return null;
  const known = KNOWN_BRANDS.find((brand) => brand.toLowerCase() === text.toLowerCase());
  return known || text;
}

function collectBrandSourceText(analyze) {
  return [
    analyze.caption,
    analyze.distinctiveFeatures,
    ...(analyze.featurePoints || []),
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Priority 1 — explicit brand fields on the analyze payload (if present).
 * @param {object} analyze
 * @returns {string | null}
 */
function pickExplicitBrandFromAnalyze(analyze) {
  const raw = analyze.raw || {};
  const candidates = [
    raw.brand,
    raw.suggested_brand,
    raw.suggestedBrand,
    analyze.brand,
    analyze.ocr?.suggested?.brand,
    analyze.ocr?.suggested?.suggested_brand,
    analyze.ocr?.suggested?.suggestedBrand,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBrandText(candidate);
    if (normalized) return canonicalizeKnownBrand(normalized);
  }

  return null;
}

/**
 * Priority 2 — structured OCR / extracted attributes (e.g. card_brand).
 * @param {object} analyze
 * @returns {string | null}
 */
function pickBrandFromMetadata(analyze) {
  const brandRow = getExtractionRows(analyze).find(
    (row) => /brand/i.test(row.key || '') && row.value,
  );
  if (brandRow?.value) {
    return canonicalizeKnownBrand(brandRow.value);
  }

  const ocrBrand = analyze.ocr?.fields?.cardBrand?.value;
  if (ocrBrand) {
    return canonicalizeKnownBrand(ocrBrand);
  }

  return null;
}

/**
 * Priority 3 — infer brand from caption / feature bullets with conservative rules.
 * @param {object} analyze
 * @returns {string | null}
 */
function pickBrandFromCaptionText(analyze) {
  const text = collectBrandSourceText(analyze);
  if (!text.trim()) return null;

  for (const { pattern, brand } of PRODUCT_LINE_BRANDS) {
    if (pattern.test(text)) return brand;
  }

  const logoPattern =
    /\b([A-Z][A-Za-z0-9&.'-]{1,30})\s+(?:logo|branding|brand(?:ing)?|emblem|wordmark)\b/gi;
  let logoMatch = logoPattern.exec(text);
  while (logoMatch) {
    const candidate = canonicalizeKnownBrand(logoMatch[1]);
    if (candidate && isKnownBrandName(candidate)) {
      return candidate;
    }
    logoMatch = logoPattern.exec(text);
  }

  for (const brand of KNOWN_BRANDS) {
    const pattern = new RegExp(`\\b${escapeRegex(brand)}\\b`, 'i');
    if (pattern.test(text)) {
      return brand;
    }
  }

  const productLead = text.match(
    /\b([A-Z][A-Za-z]{2,20})\s+(?:Galaxy|Ultraboost|Air Max|DSLR|laptop|phone|sneakers?|shoes|backpack|camera)\b/,
  );
  if (productLead) {
    const candidate = canonicalizeKnownBrand(productLead[1]);
    if (candidate && isKnownBrandName(candidate)) {
      return candidate;
    }
  }

  return null;
}

function isKnownBrandName(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return KNOWN_BRANDS.some((brand) => brand.toLowerCase() === text.toLowerCase());
}

/**
 * True when analyze signals a national ID / CNIC (not a payment card).
 * @param {object} analyze
 */
function isNationalIdAnalyze(analyze) {
  if (!analyze) return false;

  const raw = analyze.raw || {};
  const sensitiveType = String(
    analyze.sensitiveDocumentType ||
      raw.sensitive_document_type ||
      raw.sensitiveDocumentType ||
      '',
  ).toLowerCase();
  if (
    sensitiveType === 'cnic' ||
    sensitiveType === 'national_id' ||
    sensitiveType === 'id_card'
  ) {
    return true;
  }

  const docType = String(
    analyze.ocrDocumentType ||
      analyze.ocr?.documentType ||
      raw.ocr?.document_type ||
      '',
  ).toLowerCase();
  if (
    docType === 'cnic' ||
    docType === 'national_id' ||
    docType === 'id_card' ||
    docType.includes('cnic') ||
    docType.includes('national_id')
  ) {
    return true;
  }

  const haystack = [
    analyze.caption,
    analyze.distinctiveFeatures,
    analyze.ocrText,
    analyze.ocr?.ocrText,
    ...(analyze.featurePoints || []),
  ]
    .filter(Boolean)
    .join(' ');

  if (
    /\b(?:cnic|nadra|national\s+id(?:entity)?(?:\s+card)?|identity\s+card|pakistan\s+national)\b/i.test(
      haystack,
    )
  ) {
    return true;
  }

  // Shared OCR field may hold a 13-digit CNIC in card_number.
  const cardNumber =
    analyze.ocr?.fields?.cardNumber?.value ||
    analyze.ocr?.fields?.card_number?.value ||
    getExtractionRows(analyze).find((row) => row.key === 'card_number')?.value ||
    '';
  const digits = String(cardNumber).replace(/\D/g, '');
  if (digits.length === 13) return true;

  return false;
}

/**
 * True when analyze signals a credit/debit card (not CNIC / national ID).
 * @param {object} analyze
 */
function isPaymentCardAnalyze(analyze) {
  if (!analyze) return false;
  if (isNationalIdAnalyze(analyze)) return false;

  const raw = analyze.raw || {};
  const sensitiveType = String(
    analyze.sensitiveDocumentType ||
      raw.sensitive_document_type ||
      raw.sensitiveDocumentType ||
      '',
  ).toLowerCase();
  if (sensitiveType === 'credit_card' || sensitiveType === 'debit_card') {
    return true;
  }

  const docType = String(
    analyze.ocr?.documentType || raw.ocr?.document_type || analyze.ocrDocumentType || '',
  ).toLowerCase();
  if (docType === 'credit_card' || docType === 'debit_card') {
    return true;
  }

  const haystack = [
    analyze.caption,
    analyze.distinctiveFeatures,
    analyze.ocrText,
    ...(analyze.featurePoints || []),
  ]
    .filter(Boolean)
    .join(' ');
  if (/\b(?:credit\s+card|debit\s+card|payment\s+card|bank\s+card)\b/i.test(haystack)) {
    return true;
  }

  const rows = getExtractionRows(analyze);
  return rows.some((row) => {
    if (!(row.key === 'card_number' || row.key === 'expiry_date') || !row.value) return false;
    if (row.key === 'card_number' && String(row.value).replace(/\D/g, '').length === 13) {
      return false;
    }
    return true;
  });
}

/**
 * Detect Visa / Mastercard / Amex / UnionPay etc. in OCR or caption text.
 * @param {string} text
 * @returns {string | null}
 */
function detectPaymentCardBrandInText(text) {
  const haystack = String(text || '');
  if (!haystack.trim()) return null;

  for (const { pattern, brand } of PAYMENT_CARD_BRAND_RULES) {
    if (pattern.test(haystack)) {
      return brand;
    }
  }
  return null;
}

/**
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
function canonicalizePaymentCardBrand(value) {
  const text = normalizeBrandText(value);
  if (!text) return null;
  return detectPaymentCardBrandInText(text);
}

/**
 * Brand autofill for payment cards — OCR card_brand + network names only.
 * @param {object} analyze
 * @returns {string | null}
 */
function pickPaymentCardBrand(analyze) {
  const ocrBrand = analyze?.ocr?.fields?.cardBrand?.value;
  const fromOcrField = canonicalizePaymentCardBrand(ocrBrand);
  if (fromOcrField) return fromOcrField;

  const cardBrandRow = getExtractionRows(analyze).find(
    (row) => row.key === 'card_brand' && row.value,
  );
  const fromRow = canonicalizePaymentCardBrand(cardBrandRow?.value);
  if (fromRow) return fromRow;

  const sourceText = [
    ocrBrand,
    cardBrandRow?.value,
    analyze?.ocr?.ocrText,
    analyze?.caption,
    ...(analyze.featurePoints || []),
  ]
    .filter(Boolean)
    .join(' ');

  return detectPaymentCardBrandInText(sourceText);
}

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
 * Resolve brand for autofill from the existing analyze-image response.
 *
 * Priority: explicit brand field → structured metadata → caption/features inference.
 *
 * @param {object} analyze
 * @returns {string | null}
 */
export function pickBrandFromAnalyze(analyze) {
  if (!analyze) return null;

  if (isPaymentCardAnalyze(analyze)) {
    return pickPaymentCardBrand(analyze);
  }

  return (
    pickExplicitBrandFromAnalyze(analyze) ||
    pickBrandFromMetadata(analyze) ||
    pickBrandFromCaptionText(analyze)
  );
}

const MAX_ITEM_NAME_LENGTH = 60;

/**
 * True when text looks like a descriptive paragraph rather than a short item name.
 * @param {string} text
 */
function looksLikeDescription(text) {
  const value = String(text || '').trim();
  if (!value) return true;
  if (value.length > MAX_ITEM_NAME_LENGTH) return true;
  if (/[.!?]/.test(value)) return true;
  if ((value.match(/,/g) || []).length >= 2) return true;
  if (/\b(with|featuring|that|which|appears|located|found|visible)\b/i.test(value)) return true;
  // Long "A black leather wallet sitting on..." style captions.
  if (/^(a|an|the)\s+\w+/i.test(value) && value.split(/\s+/).length > 6) return true;
  return false;
}

/**
 * Build a short display name from brand + detected object class.
 * @param {string | null} brand
 * @param {string | null} objectLabel
 */
function composeShortItemName(brand, objectLabel) {
  const label = objectLabel ? humanizeKey(objectLabel) : '';
  const brandText = brand ? String(brand).trim() : '';
  if (brandText && label) {
    // Avoid "Apple Apple Phone"
    if (label.toLowerCase().includes(brandText.toLowerCase())) return label.slice(0, MAX_ITEM_NAME_LENGTH);
    return `${brandText} ${label}`.slice(0, MAX_ITEM_NAME_LENGTH).trim();
  }
  if (label) return label.slice(0, MAX_ITEM_NAME_LENGTH);
  if (brandText) return brandText.slice(0, MAX_ITEM_NAME_LENGTH);
  return null;
}

/**
 * Pull a short noun-ish phrase from a caption without copying the full description.
 * @param {string} caption
 */
function pickShortTitleFromCaption(caption) {
  const text = String(caption || '').trim();
  if (!text) return null;

  // Prefer leading "A/An/The <short noun phrase>" before "with/featuring/that..."
  const leading = text.match(
    /^(?:a|an|the)\s+((?:[a-z0-9/-]+(?:\s+[a-z0-9/-]+){0,4}))(?=\s+(?:with|featuring|that|which|on|in|at|near|sitting|lying|visible|,|\.|!|\?|$))/i,
  );
  if (leading?.[1]) {
    const phrase = leading[1].trim();
    if (!looksLikeDescription(phrase)) {
      return humanizeKey(phrase.replace(/\s+/g, ' '));
    }
  }

  // Fallback: first 2–5 words only, never a sentence.
  const words = text
    .replace(/^[Aa][Nn]?\s+|^[Tt]he\s+/, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  if (!words.length) return null;
  const candidate = words.join(' ').replace(/[,:;]+$/, '').trim();
  if (!candidate || looksLikeDescription(candidate)) return null;
  return humanizeKey(candidate);
}

/**
 * Short item name for the report form — never the full caption/description.
 * @param {object} analyze Normalized analyze snapshot
 * @returns {string | null}
 */
export function pickTitleFromAnalyze(analyze) {
  if (!analyze) return null;

  // Identity docs first — OCR often stores CNIC digits in card_number and
  // previously mislabeled them as payment cards.
  if (isNationalIdAnalyze(analyze)) {
    return 'CNIC / ID Card';
  }

  const brand = pickBrandFromAnalyze(analyze);

  if (isPaymentCardAnalyze(analyze)) {
    return composeShortItemName(brand, 'Payment Card') || 'Payment Card';
  }

  const objects = analyze.objectDetection?.detectedObjects || [];
  const topObject = objects.length
    ? [...objects].sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0]
    : null;
  const objectLabel = topObject?.className || null;

  const fromObject = composeShortItemName(brand, objectLabel);
  if (fromObject) return fromObject;

  const suggested =
    analyze.ocr?.suggested?.suggested_title || analyze.ocr?.suggested?.suggestedTitle;
  if (typeof suggested === 'string' && suggested.trim() && !looksLikeDescription(suggested)) {
    const shortSuggested = suggested.trim().slice(0, MAX_ITEM_NAME_LENGTH);
    // Reject leftover payment-card suggestions when caption already named an ID.
    if (/payment\s*card/i.test(shortSuggested) && isNationalIdAnalyze(analyze)) {
      return 'CNIC / ID Card';
    }
    return brand && !shortSuggested.toLowerCase().includes(brand.toLowerCase())
      ? composeShortItemName(brand, shortSuggested) || shortSuggested
      : shortSuggested;
  }

  const fromCaption = pickShortTitleFromCaption(analyze.caption || '');
  if (fromCaption) {
    return composeShortItemName(brand, fromCaption) || fromCaption;
  }

  if (brand) return brand.slice(0, MAX_ITEM_NAME_LENGTH);

  return null;
}

/**
 * Report categories accepted by POST /api/items.
 */
const REPORT_CATEGORIES = new Set([
  'Electronics',
  'Clothing',
  'Documents',
  'Accessories',
  'Other',
]);

/** Caption keywords for category when server OCR misroutes (e.g. keys → Documents). */
const CAPTION_CATEGORY_RULES = [
  {
    patterns: [
      /\bcnic\b/i,
      /\bnational\s+id(?:entity)?(?:\s+card)?\b/i,
      /\bidentity\s+card\b/i,
      /\bpassport\b/i,
      /\bdriving\s+licen[cs]e\b/i,
    ],
    category: 'Documents',
  },
  {
    patterns: [/\bkeys?\b/i, /\bkeychain\b/i, /\bkey ring\b/i, /\bkey set\b/i, /\bhouse keys?\b/i],
    category: 'Other',
  },
  {
    patterns: [/\b(wallet|purse)\b/i],
    category: 'Accessories',
  },
  {
    patterns: [/\b(watch|wristwatch|wrist watch)\b/i],
    category: 'Accessories',
  },
];

function pickCategoryFromCaptionKeywords(analyze) {
  if (!analyze) return null;
  const text = [
    analyze.caption,
    analyze.distinctiveFeatures,
    ...(analyze.featurePoints || []),
  ]
    .filter(Boolean)
    .join(' ');
  if (!text.trim()) return null;

  for (const rule of CAPTION_CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.category;
    }
  }
  return null;
}

/**
 * Condition hints parsed from Gemini caption / feature text (UI-only field).
 * Order matters: more specific damage terms before generic "good".
 */
const CONDITION_HINTS = [
  {
    value: 'Damaged',
    patterns: [/\bdamaged\b/i, /\bcracked\b/i, /\bbroken\b/i, /\btorn\b/i, /\bdented?\b/i],
  },
  {
    value: 'Worn',
    patterns: [
      /\bworn\b/i,
      /\bscratched\b/i,
      /\bscratch(?:es|ed)?\b/i,
      /\bscuffed\b/i,
      /\bfaded\b/i,
      /\bheavy use\b/i,
    ],
  },
  {
    value: 'Fair',
    patterns: [
      /\bfair condition\b/i,
      /\bfair\b/i,
      /\bacceptable condition\b/i,
      /\bacceptable\b/i,
      /\bsome wear\b/i,
    ],
  },
  {
    value: 'Excellent',
    patterns: [
      /\bexcellent condition\b/i,
      /\bexcellent\b/i,
      /\blike new\b/i,
      /\bmint condition\b/i,
      /\bpristine\b/i,
      /\bno visible (?:scratch|damage|wear)\b/i,
    ],
  },
  {
    value: 'Good',
    patterns: [
      /\bgood condition\b/i,
      /\bin good condition\b/i,
      /\blightly used\b/i,
      /\bminor wear\b/i,
      /\bgood\b/i,
    ],
  },
];

/**
 * @param {object} analyze Normalized analyze snapshot
 * @returns {string | null}
 */
export function pickCategoryFromAnalyze(analyze) {
  if (!analyze) return null;

  if (isNationalIdAnalyze(analyze) || isPaymentCardAnalyze(analyze)) {
    return 'Documents';
  }

  const fromCaption = pickCategoryFromCaptionKeywords(analyze);
  const suggested = analyze.suggestedCategory
    ? String(analyze.suggestedCategory).trim()
    : null;

  // Prefer caption keywords over a false Documents suggestion from noisy OCR.
  if (fromCaption && suggested === 'Documents' && fromCaption !== 'Documents') {
    return REPORT_CATEGORIES.has(fromCaption) ? fromCaption : null;
  }

  if (suggested && REPORT_CATEGORIES.has(suggested)) {
    return suggested;
  }

  if (fromCaption && REPORT_CATEGORIES.has(fromCaption)) {
    return fromCaption;
  }

  return null;
}

/**
 * @param {object} analyze Normalized analyze snapshot
 * @returns {string | null} One of CONDITION_OPTIONS values (excluding empty)
 */
export function pickConditionFromAnalyze(analyze) {
  if (!analyze) return null;

  const attributeRow = (analyze.extractedAttributes || []).find((row) =>
    /condition/i.test(row.key || ''),
  );
  if (attributeRow?.value) {
    const normalized = String(attributeRow.value).trim();
    const match = CONDITION_HINTS.find(
      (hint) => hint.value.toLowerCase() === normalized.toLowerCase(),
    );
    if (match) return match.value;
  }

  const text = [
    analyze.caption,
    analyze.distinctiveFeatures,
    ...(analyze.featurePoints || []),
  ]
    .filter(Boolean)
    .join(' ');

  if (!text.trim()) return null;

  for (const hint of CONDITION_HINTS) {
    if (hint.patterns.some((pattern) => pattern.test(text))) {
      return hint.value;
    }
  }

  return null;
}

export function formatFeaturePoints(points) {
  if (!Array.isArray(points) || !points.length) return '';
  return points.map((p) => (p.startsWith('•') ? p : `• ${p}`)).join('\n');
}

/**
 * Case-insensitive dedupe while preserving first-seen casing.
 * @param {string[]} chips
 * @returns {string[]}
 */
export function dedupeFeatureChips(chips) {
  const seen = new Set();
  const result = [];
  for (const chip of chips) {
    const text = String(chip || '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

/**
 * Parse stored/API distinctive-features text or arrays into chip labels.
 * @param {string | string[] | null | undefined} input
 * @returns {string[]}
 */
export function parseDistinctiveFeaturesInput(input) {
  if (input == null || input === '') return [];

  if (Array.isArray(input)) {
    return dedupeFeatureChips(input);
  }

  const text = String(input).trim();
  if (!text) return [];

  if (!text.includes('\n') && text.includes(',')) {
    return dedupeFeatureChips(text.split(',').map((part) => part.trim()));
  }

  return dedupeFeatureChips(
    text
      .split('\n')
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean),
  );
}

/**
 * Serialize chips to the bullet-newline string used by POST /api/items.
 * @param {string[]} chips
 * @returns {string}
 */
export function serializeFeatureChips(chips) {
  const normalized = dedupeFeatureChips(chips);
  if (!normalized.length) return '';
  return formatFeaturePoints(normalized);
}

/**
 * @param {object | null | undefined} analyze Normalized analyze snapshot
 * @returns {string[]}
 */
export function resolveAiDistinctiveFeatureChips(analyze) {
  if (!analyze) return [];
  if (Array.isArray(analyze.featurePoints) && analyze.featurePoints.length) {
    return parseDistinctiveFeaturesInput(analyze.featurePoints);
  }
  return parseDistinctiveFeaturesInput(resolveAiDistinctiveFeatures(analyze));
}

export function resolveAiDistinctiveFeatures(analyze) {
  if (!analyze) return '';
  if (analyze.distinctiveFeatures?.trim()) {
    return analyze.distinctiveFeatures.trim();
  }
  return formatFeaturePoints(analyze.featurePoints);
}
