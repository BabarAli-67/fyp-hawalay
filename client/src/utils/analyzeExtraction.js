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

  return (
    pickExplicitBrandFromAnalyze(analyze) ||
    pickBrandFromMetadata(analyze) ||
    pickBrandFromCaptionText(analyze)
  );
}

/**
 * @param {object} analyze Normalized analyze snapshot
 * @returns {string | null}
 */
export function pickTitleFromAnalyze(analyze) {
  if (!analyze) return null;

  const suggested =
    analyze.ocr?.suggested?.suggested_title || analyze.ocr?.suggested?.suggestedTitle;
  if (typeof suggested === 'string' && suggested.trim()) {
    return suggested.trim();
  }

  const objects = analyze.objectDetection?.detectedObjects || [];
  if (objects.length) {
    const top = [...objects].sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
    if (top?.className) return humanizeKey(top.className);
  }

  const caption = (analyze.caption || '').trim();
  if (caption) {
    const firstSentence = caption.split(/[.!?]/)[0]?.trim();
    if (firstSentence && firstSentence.length <= 100) return firstSentence;
  }

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
  if (!analyze?.suggestedCategory) return null;
  const category = String(analyze.suggestedCategory).trim();
  return REPORT_CATEGORIES.has(category) ? category : null;
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
