/**
 * Configuration-driven object_v1 category suggestions.
 *
 * Single source of truth (shared with ai-server):
 *   - class_names.json
 *   - category_map.json
 *   - weights/hawalay_final_model.keras (validated for deployment readiness)
 *
 * Replace artifact files and restart — no code changes required.
 */

const fs = require('fs');
const path = require('path');

const REPORT_CATEGORIES = ['Electronics', 'Clothing', 'Documents', 'Accessories', 'Other'];

const SERVER_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(SERVER_ROOT, '..');

const DEFAULT_WEIGHTS = path.join(
  REPO_ROOT,
  'ai-server',
  'artifacts',
  'object_v1',
  'weights',
  'hawalay_final_model.keras',
);
const DEFAULT_CLASS_NAMES = path.join(
  REPO_ROOT,
  'ai-server',
  'artifacts',
  'object_v1',
  'class_names.json',
);
const DEFAULT_CATEGORY_MAP = path.join(
  REPO_ROOT,
  'ai-server',
  'artifacts',
  'object_v1',
  'category_map.json',
);

/** @type {string[]} */
let classNames = [];
/** @type {Record<string, string>} */
let categoryMap = {};
let objectModelReady = false;

function resolveArtifactPath(envKey, fallbackAbsolutePath) {
  const raw = process.env[envKey]?.trim();
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(SERVER_ROOT, raw);
  }
  return fallbackAbsolutePath;
}

function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeClassNameList(raw) {
  if (Array.isArray(raw)) {
    return raw.map((name) => String(name).trim()).filter(Boolean);
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw)
      .map(([key, value]) => {
        const id = Number.parseInt(key, 10);
        if (!Number.isFinite(id)) return null;
        const name = String(value).trim();
        return name ? { id, name } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.id - b.id)
      .map((row) => row.name);
  }
  return [];
}

function loadCategoryMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(raw)
      .map(([key, value]) => [String(key).trim(), String(value).trim()])
      .filter(([key, value]) => key && value),
  );
}

/**
 * Load and validate object_v1 artifacts at startup.
 * Logs errors/warnings; does not throw.
 */
function initializeObjectModelConfig() {
  classNames = [];
  categoryMap = {};
  objectModelReady = false;

  const weightsPath = resolveArtifactPath('OBJECT_MODEL_PATH', DEFAULT_WEIGHTS);
  const classNamesPath = resolveArtifactPath('OBJECT_CLASS_NAMES_PATH', DEFAULT_CLASS_NAMES);
  const categoryMapPath = resolveArtifactPath('OBJECT_CATEGORY_MAP_PATH', DEFAULT_CATEGORY_MAP);

  const weightsExists = fs.existsSync(weightsPath);
  const classNamesExists = fs.existsSync(classNamesPath);
  const categoryMapExists = fs.existsSync(categoryMapPath);

  if (!weightsExists) {
    if (classNamesExists || categoryMapExists) {
      console.warn(
        `[object_v1] weights missing at ${weightsPath} but JSON artifact(s) present — ` +
          'object detector will stay unavailable until hawalay_final_model.keras is added',
      );
    } else {
      console.info(
        '[object_v1] not deployed — add hawalay_final_model.keras, class_names.json, and category_map.json then restart',
      );
    }
    return { ready: false, classCount: 0, weightsPath, classNamesPath, categoryMapPath };
  }

  if (!classNamesExists) {
    console.error(
      `[object_v1] class_names.json missing at ${classNamesPath} — required when ${path.basename(weightsPath)} is present`,
    );
    return { ready: false, classCount: 0, weightsPath, classNamesPath, categoryMapPath };
  }

  if (!categoryMapExists) {
    console.error(
      `[object_v1] category_map.json missing at ${categoryMapPath} — required when ${path.basename(weightsPath)} is present`,
    );
    return { ready: false, classCount: 0, weightsPath, classNamesPath, categoryMapPath };
  }

  const rawNames = readJsonFile(classNamesPath);
  if (rawNames == null) {
    console.error(`[object_v1] class_names.json is invalid or unreadable: ${classNamesPath}`);
    return { ready: false, classCount: 0, weightsPath, classNamesPath, categoryMapPath };
  }

  const parsedClassNames = normalizeClassNameList(rawNames);
  if (!parsedClassNames.length) {
    console.error(`[object_v1] class_names.json contains no valid classes: ${classNamesPath}`);
    return { ready: false, classCount: 0, weightsPath, classNamesPath, categoryMapPath };
  }

  if (new Set(parsedClassNames).size !== parsedClassNames.length) {
    console.error(`[object_v1] class_names.json contains duplicate class names: ${classNamesPath}`);
    return { ready: false, classCount: 0, weightsPath, classNamesPath, categoryMapPath };
  }

  const rawMap = readJsonFile(categoryMapPath);
  const parsedMap = loadCategoryMap(rawMap);
  if (!Object.keys(parsedMap).length) {
    console.error(`[object_v1] category_map.json is empty or invalid: ${categoryMapPath}`);
    return { ready: false, classCount: 0, weightsPath, classNamesPath, categoryMapPath };
  }

  const missingMappings = parsedClassNames.filter((name) => !(name in parsedMap));
  if (missingMappings.length) {
    const preview = missingMappings.slice(0, 8).join(', ');
    const suffix = missingMappings.length > 8 ? '…' : '';
    console.error(
      `[object_v1] category_map.json missing ${missingMappings.length} class(es): ${preview}${suffix}`,
    );
    return { ready: false, classCount: 0, weightsPath, classNamesPath, categoryMapPath };
  }

  const invalidEntry = Object.entries(parsedMap).find(
    ([, category]) => !REPORT_CATEGORIES.includes(category),
  );
  if (invalidEntry) {
    console.error(
      `[object_v1] category_map.json has invalid report category for '${invalidEntry[0]}': ` +
        `'${invalidEntry[1]}' (allowed: ${REPORT_CATEGORIES.join(', ')})`,
    );
    return { ready: false, classCount: 0, weightsPath, classNamesPath, categoryMapPath };
  }

  const extraKeys = Object.keys(parsedMap).filter((key) => !parsedClassNames.includes(key));
  if (extraKeys.length) {
    const preview = extraKeys.slice(0, 8).join(', ');
    const suffix = extraKeys.length > 8 ? '…' : '';
    console.warn(
      `[object_v1] category_map.json has ${extraKeys.length} extra key(s) not in class_names.json: ${preview}${suffix}`,
    );
  }

  classNames = parsedClassNames;
  categoryMap = parsedMap;
  objectModelReady = true;

  console.info(
    `[object_v1] artifact bundle valid — ${classNames.length} class(es), category_map complete`,
  );

  return {
    ready: true,
    classCount: classNames.length,
    weightsPath,
    classNamesPath,
    categoryMapPath,
  };
}

function getClassNames() {
  return [...classNames];
}

function getCategoryMap() {
  return { ...categoryMap };
}

function isObjectModelReady() {
  return objectModelReady;
}

/** OCR document types that map to report category Documents. */
const OCR_DOCUMENT_TYPES = new Set([
  'credit_card',
  'cnic',
  'id_card',
  'national_id',
  'passport',
  'driving_license',
]);

const OCR_CARD_FIELD_KEYS = ['card_number', 'cardholder_name', 'card_brand', 'expiry_date'];

const OCR_DOCUMENT_LABELS = {
  credit_card: 'bank or payment card',
  cnic: 'national ID card (CNIC)',
  id_card: 'ID card',
  national_id: 'national ID card',
  passport: 'passport',
  driving_license: 'driving license',
};

const OCR_CATEGORY_CONFIDENCE_THRESHOLD = Number(
  process.env.OCR_CATEGORY_CONFIDENCE_THRESHOLD || 0.35,
);

const OBJECT_CATEGORY_CONFIDENCE_THRESHOLD = Number(
  process.env.OBJECT_CATEGORY_CONFIDENCE_THRESHOLD || 0.55,
);

/** Caption / feature keywords → report category (non-document personal items). */
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
    label: 'identity document',
  },
  {
    patterns: [/\bkeys?\b/i, /\bkeychain\b/i, /\bkey ring\b/i, /\bkey set\b/i, /\bhouse keys?\b/i],
    category: 'Other',
    label: 'keys',
  },
  {
    patterns: [/\b(wallet|purse)\b/i],
    category: 'Accessories',
    label: 'wallet',
  },
  {
    patterns: [/\b(watch|wristwatch|wrist watch)\b/i],
    category: 'Accessories',
    label: 'watch',
  },
  {
    patterns: [/\b(glasses|eyeglasses|sunglasses)\b/i],
    category: 'Accessories',
    label: 'glasses',
  },
  {
    patterns: [/\b(backpack|handbag|shoulder bag|bag)\b/i],
    category: 'Accessories',
    label: 'bag',
  },
];

/**
 * @param {object | null | undefined} ocr
 */
function extractOcrBlock(ocrOrAnalyze) {
  if (!ocrOrAnalyze || typeof ocrOrAnalyze !== 'object') return null;
  if (ocrOrAnalyze.ocr && typeof ocrOrAnalyze.ocr === 'object') {
    return ocrOrAnalyze.ocr;
  }
  return ocrOrAnalyze;
}

/**
 * @param {object | null | undefined} ocr
 */
function ocrHasCardFields(ocr) {
  if (!ocr || typeof ocr !== 'object') return false;
  const fields = ocr.fields && typeof ocr.fields === 'object' ? ocr.fields : {};
  return OCR_CARD_FIELD_KEYS.some((key) => {
    const fromFields = fields[key]?.value ?? fields[key];
    const flat = ocr[key];
    const text = fromFields != null ? fromFields : flat;
    return text != null && String(text).trim() !== '';
  });
}

function extractOcrFieldText(ocr, key) {
  if (!ocr || typeof ocr !== 'object') return '';
  const fields = ocr.fields && typeof ocr.fields === 'object' ? ocr.fields : {};
  const fromFields = fields[key]?.value ?? fields[key];
  const flat = ocr[key];
  const text = fromFields != null ? fromFields : flat;
  return text != null ? String(text).trim() : '';
}

function ocrLooksLikeNationalId(ocr) {
  if (!ocr || typeof ocr !== 'object') return false;
  const docType = String(ocr.document_type || ocr.documentType || '')
    .trim()
    .toLowerCase();
  if (['cnic', 'national_id', 'id_card'].includes(docType)) return true;

  const haystack = [
    extractOcrFieldText(ocr, 'card_number'),
    extractOcrFieldText(ocr, 'cardholder_name'),
    ocr.ocr_text || ocr.ocrText || '',
  ].join(' ');

  if (
    /\b(?:cnic|nadra|national\s+id(?:entity)?(?:\s+card)?|identity\s+card|pakistan\s+national)\b/i.test(
      haystack,
    )
  ) {
    return true;
  }

  const digits = extractOcrFieldText(ocr, 'card_number').replace(/\D/g, '');
  return digits.length === 13;
}

/**
 * @param {object | null | undefined} ocr
 * @param {{ allowInferredCard?: boolean }} [options]
 * @returns {string | null}
 */
function resolveOcrDocumentType(ocr, { allowInferredCard = false } = {}) {
  if (!ocr || typeof ocr !== 'object') return null;
  if (ocrLooksLikeNationalId(ocr)) return 'cnic';

  const docType = String(ocr.document_type || ocr.documentType || 'unknown')
    .trim()
    .toLowerCase();
  if (OCR_DOCUMENT_TYPES.has(docType)) return docType;
  if (allowInferredCard && docType === 'unknown' && ocrHasCardFields(ocr)) {
    return 'credit_card';
  }
  return null;
}

function isSensitiveAnalyzePayload(analyzePayload) {
  if (!analyzePayload || typeof analyzePayload !== 'object') return false;
  return analyzePayload.is_sensitive === true || analyzePayload.isSensitive === true;
}

/**
 * Collect caption / feature text from analyze payload for keyword category rules.
 * @param {object | null | undefined} analyzePayload
 */
function collectAnalyzeCategoryText(analyzePayload) {
  if (!analyzePayload || typeof analyzePayload !== 'object') return '';
  return [
    analyzePayload.caption,
    analyzePayload.distinctive_features,
    analyzePayload.distinctiveFeatures,
    ...(Array.isArray(analyzePayload.feature_points)
      ? analyzePayload.feature_points
      : []),
    ...(Array.isArray(analyzePayload.featurePoints) ? analyzePayload.featurePoints : []),
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Suggest category from Gemini caption / feature bullets (keys, wallet, etc.).
 * @param {object | null | undefined} analyzePayload
 */
function suggestCategoryFromAnalyzeText(analyzePayload) {
  const text = collectAnalyzeCategoryText(analyzePayload);
  if (!text.trim()) return null;

  for (const rule of CAPTION_CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return {
        category: rule.category,
        confidence: 0.72,
        source: 'analyze_text',
        documentType: null,
        label: rule.label,
      };
    }
  }
  return null;
}

/**
 * @param {Array<{ className?: string, confidence?: number }>} detectedObjects
 */
function getObjectCategorySuggestion(detectedObjects) {
  if (!objectModelReady || !detectedObjects?.length) return null;

  const best = detectedObjects.reduce((top, item) => {
    const conf = Number(item?.confidence ?? 0);
    if (!top || conf > top.confidence) {
      return { className: item?.className || '', confidence: conf };
    }
    return top;
  }, null);

  if (!best?.className) return null;

  const category = categoryMap[best.className];
  if (!REPORT_CATEGORIES.includes(category)) return null;

  return {
    category,
    confidence: Number(best.confidence ?? 0),
    source: 'object_v1',
    documentType: null,
    label: best.className.replace(/_/g, ' '),
  };
}

/**
 * Confidence for effectiveCategory when category comes from OCR.
 *
 * @param {object | null | undefined} ocr
 */
function getOcrCategoryConfidence(ocr) {
  if (!ocr || typeof ocr !== 'object') return 0;
  const base = Number(ocr.overall_confidence ?? ocr.overallConfidence ?? 0);
  if (ocrHasCardFields(ocr)) {
    return Math.max(Number.isFinite(base) ? base : 0, 0.75);
  }
  return Number.isFinite(base) ? base : 0;
}

/**
 * Suggest report category from card OCR (ID cards, CNIC, payment cards).
 *
 * @param {object | null | undefined} ocrOrAnalyze
 * @returns {string | null}
 */
function suggestCategoryFromOcr(ocrOrAnalyze, { allowInferredCard = false } = {}) {
  const ocr = extractOcrBlock(ocrOrAnalyze);
  if (!ocr || ocr.success !== true) return null;

  const documentType = resolveOcrDocumentType(ocr, { allowInferredCard });
  if (!documentType) return null;

  const confidence = getOcrCategoryConfidence(ocr);
  if (confidence < OCR_CATEGORY_CONFIDENCE_THRESHOLD && !ocrHasCardFields(ocr)) {
    return null;
  }

  return 'Documents';
}

/**
 * Metadata for UI and item create (source, hint label, confidence).
 *
 * @param {object | null | undefined} ocrOrAnalyze
 */
function getOcrCategorySuggestion(ocrOrAnalyze, { allowInferredCard = false } = {}) {
  const ocr = extractOcrBlock(ocrOrAnalyze);
  const category = suggestCategoryFromOcr(ocr, { allowInferredCard });
  if (!category) return null;

  const documentType = resolveOcrDocumentType(ocr, { allowInferredCard });
  return {
    category,
    confidence: getOcrCategoryConfidence(ocr),
    source: 'card_ocr_v1',
    documentType,
    label: OCR_DOCUMENT_LABELS[documentType] || 'identity document',
  };
}

/**
 * Merge OCR, object_v1, and caption keyword suggestions.
 *
 * Priority:
 * 1. Sensitive documents → OCR Documents (IDs / cards)
 * 2. Confident object_v1 detection
 * 3. Caption / feature keywords (keys, wallet, etc.)
 * 4. OCR Documents (explicit document type, or inferred card fields when sensitive)
 * 5. Low-confidence object_v1
 *
 * @param {{
 *   detectedObjects?: Array<{ className?: string, confidence?: number }>,
 *   ocr?: object | null,
 *   analyzePayload?: object | null,
 * }} params
 */
function resolveSuggestedCategory({ detectedObjects = [], ocr = null, analyzePayload = null }) {
  const ocrBlock = extractOcrBlock(ocr || analyzePayload);
  const sensitive = isSensitiveAnalyzePayload(analyzePayload);

  if (sensitive) {
    const sensitiveOcr = getOcrCategorySuggestion(ocrBlock, { allowInferredCard: true });
    if (sensitiveOcr) return sensitiveOcr;
  }

  const objectSuggestion = getObjectCategorySuggestion(detectedObjects);
  if (
    objectSuggestion &&
    objectSuggestion.confidence >= OBJECT_CATEGORY_CONFIDENCE_THRESHOLD
  ) {
    return objectSuggestion;
  }

  const textSuggestion = suggestCategoryFromAnalyzeText(analyzePayload);
  if (textSuggestion) return textSuggestion;

  const ocrSuggestion = getOcrCategorySuggestion(ocrBlock, {
    allowInferredCard: sensitive,
  });
  if (ocrSuggestion) return ocrSuggestion;

  if (objectSuggestion) return objectSuggestion;

  return null;
}

/**
 * Suggest a report category from object detections (highest confidence wins).
 * Returns null when artifacts are not ready or there are no detections.
 *
 * @param {Array<{ className?: string, confidence?: number }>} detectedObjects
 * @returns {string | null}
 */
function suggestCategoryFromDetections(detectedObjects) {
  if (!objectModelReady || !detectedObjects?.length) {
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

  const suggested = categoryMap[best.className];
  return REPORT_CATEGORIES.includes(suggested) ? suggested : null;
}

module.exports = {
  REPORT_CATEGORIES,
  initializeObjectModelConfig,
  getClassNames,
  getCategoryMap,
  isObjectModelReady,
  suggestCategoryFromDetections,
  suggestCategoryFromOcr,
  suggestCategoryFromAnalyzeText,
  getOcrCategorySuggestion,
  getObjectCategorySuggestion,
  resolveSuggestedCategory,
  getOcrCategoryConfidence,
  OCR_DOCUMENT_TYPES,
};
