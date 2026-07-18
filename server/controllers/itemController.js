const Item = require('../models/Item');
const { triggerMatchingWithRetry } = require('../services/matchingService');
const {
  analyzeImage: callAnalyzeImage,
  postMultipart,
  mapAiServiceError,
  DEFAULT_TIMEOUT_MS,
  OCR_TIMEOUT_MS,
} = require('../services/aiClient');
const { deleteFromGridFS, getImageStream, uploadToGridFS } = require('../utils/imageStorage');
const { resolveSuggestedCategory } = require('../utils/categoryMapping');
const { resolveCategoryFields, applyResolvedCategoryToItem } = require('../utils/categoryResolution');
const { resolveItemEmbedding } = require('../utils/itemEmbedding');
const { buildItemsListFilter } = require('../utils/itemSearch');
const { stashSensitiveRegions, takeSensitiveRegions } = require('../utils/pendingSensitiveRegions');
const { stashAnalyzePayload, takeAnalyzePayload } = require('../utils/pendingAnalyzePayload');
const {
  extractSensitiveRegions,
  stripSensitiveRegionsFromAnalyzePayload,
  stripSensitiveMetadataFromItem,
} = require('../utils/sensitiveOcrRegions');
const { protectSensitiveImage } = require('../utils/sensitiveImageMask');
const { applyPublicTextPrivacy, maskAnalyzePayloadForClient } = require('../utils/sensitiveTextMask');
const { resolveCreateItemAnalyzeContext } = require('../utils/resolveCreateItemAnalyzeContext');

const CATEGORIES = ['Electronics', 'Clothing', 'Documents', 'Accessories', 'Other'];
const REPORT_TYPES = ['lost', 'found'];

function parseEmbeddingVector(raw) {
  if (raw == null || raw === '') return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function parseGeoPoint(raw, { allowLegacyLatLng = false, latKey, lngKey } = {}) {
  let location = raw;
  if (location == null || location === '') return null;
  if (typeof location === 'string') {
    try {
      location = JSON.parse(location);
    } catch {
      return null;
    }
  }

  if (
    location &&
    Array.isArray(location.coordinates) &&
    location.coordinates.length === 2
  ) {
    const lng = Number(location.coordinates[0]);
    const lat = Number(location.coordinates[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return { type: 'Point', coordinates: [lng, lat] };
    }
  }

  if (allowLegacyLatLng && latKey && lngKey) {
    const lng = Number(location[lngKey]);
    const lat = Number(location[latKey]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return { type: 'Point', coordinates: [lng, lat] };
    }
  }

  return null;
}

function parseLocation(body) {
  const fromJson = parseGeoPoint(body.location);
  if (fromJson) return fromJson;
  if (body.longitude != null && body.latitude != null) {
    return parseGeoPoint(
      { coordinates: [Number(body.longitude), Number(body.latitude)] },
      {},
    );
  }
  return null;
}

function parseColors(raw) {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) {
    return raw.map((c) => String(c).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => String(c).trim()).filter(Boolean);
      }
    } catch {
      return raw
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
    }
  }
  return [];
}

const CONTACT_PREFERENCES = ['in_app_chat', 'show_email'];
const OCR_STATUS_VALUES = ['success', 'degraded', 'failed', 'skipped'];
const OBJECT_STATUS_VALUES = ['success', 'skipped', 'unavailable', 'error', 'degraded'];

function parseAnalyzeResult(req) {
  if (req.analyzeResult && typeof req.analyzeResult === 'object') {
    return req.analyzeResult;
  }
  const raw = req.body?.analyzeResult ?? req.body?.aiAnalyzeResult;
  if (raw == null || raw === '') {
    return null;
  }
  if (typeof raw === 'object') {
    return raw;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function mapOcrStatusForMetadata(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'success') return 'success';
  if (normalized === 'degraded' || normalized === 'no_regions') return 'degraded';
  if (normalized === 'error') return 'failed';
  return 'skipped';
}

function mapObjectStatusForMetadata(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'success') return 'success';
  if (normalized === 'unavailable') return 'unavailable';
  if (normalized === 'error') return 'error';
  if (normalized === 'degraded') return 'degraded';
  return 'skipped';
}

function mapDetectedObjects(aiResponse) {
  const block = aiResponse?.object_detection || aiResponse?.objectDetection;
  if (!block || typeof block !== 'object') return [];

  const rawList = block.detected_objects || block.detectedObjects || [];
  if (!Array.isArray(rawList)) return [];

  const source = block.model || 'object_v1';
  return rawList
    .map((item) => {
      const className = String(item?.class_name || item?.className || '').trim();
      if (!className) return null;
      const confidence = Number(item?.confidence ?? 0);
      const bbox = Array.isArray(item?.bbox) ? item.bbox.map((n) => Number(n)) : [];
      return {
        className,
        confidence: Number.isFinite(confidence) ? confidence : 0,
        bbox: bbox.length === 4 ? bbox : undefined,
        source,
      };
    })
    .filter(Boolean);
}

const OCR_SENSITIVE_DOCUMENT_TYPES = new Set([
  'cnic',
  'national_id',
  'id_card',
  'credit_card',
  'debit_card',
]);

function ocrFieldValue(ocr, key) {
  if (!ocr || typeof ocr !== 'object') return '';
  const fields = ocr.fields;
  if (fields && typeof fields === 'object') {
    const entry = fields[key];
    if (entry && typeof entry === 'object' && entry.value != null && String(entry.value).trim()) {
      return String(entry.value).trim();
    }
  }
  const flat = ocr[key];
  if (flat != null && String(flat).trim()) {
    return String(flat).trim();
  }
  return '';
}

/**
 * Mirrors ai-server ``sensitivity_detection._classify_payment_card_type``.
 * @param {object} ocr
 */
function classifyPaymentCardTypeFromOcr(ocr) {
  const brand = ocrFieldValue(ocr, 'card_brand').toLowerCase();
  const combined = [
    brand,
    ocrFieldValue(ocr, 'card_number'),
    String(ocr.ocr_text || ocr.ocrText || ''),
  ]
    .join(' ')
    .toLowerCase();
  return combined.includes('debit') ? 'debit_card' : 'credit_card';
}

/**
 * OCR field heuristics aligned with create-time detection
 * (ai-server ``sensitivity_detection._classify_from_ocr``).
 * @param {object | null | undefined} ocr
 * @returns {{ isSensitive: true, sensitiveDocumentType: string } | null}
 */
function resolveSensitivityFromOcrFields(ocr) {
  if (!ocr || typeof ocr !== 'object') {
    return null;
  }

  const docType = String(ocr.document_type || ocr.documentType || '')
    .trim()
    .toLowerCase();

  if (docType === 'cnic') {
    return { isSensitive: true, sensitiveDocumentType: 'cnic' };
  }
  if (docType === 'national_id' || docType === 'id_card') {
    return { isSensitive: true, sensitiveDocumentType: 'national_id' };
  }
  if (docType === 'debit_card') {
    return { isSensitive: true, sensitiveDocumentType: 'debit_card' };
  }
  if (docType === 'credit_card' || OCR_SENSITIVE_DOCUMENT_TYPES.has(docType)) {
    return { isSensitive: true, sensitiveDocumentType: classifyPaymentCardTypeFromOcr(ocr) };
  }

  if (ocrFieldValue(ocr, 'card_number') || ocrFieldValue(ocr, 'expiry_date')) {
    return { isSensitive: true, sensitiveDocumentType: classifyPaymentCardTypeFromOcr(ocr) };
  }

  return null;
}

/**
 * @param {object} payload
 * @param {{ isSensitive: boolean, sensitiveDocumentType: string | null }} sensitivity
 */
function applyResolvedSensitivityToAnalyzePayload(payload, sensitivity) {
  return {
    ...payload,
    is_sensitive: sensitivity.isSensitive,
    isSensitive: sensitivity.isSensitive,
    sensitive_document_type: sensitivity.sensitiveDocumentType,
    sensitiveDocumentType: sensitivity.sensitiveDocumentType,
  };
}

function resolveIsSensitiveFromAnalyze(aiResponse) {
  if (!aiResponse || typeof aiResponse !== 'object') {
    return { isSensitive: false, sensitiveDocumentType: null };
  }

  if (aiResponse.is_sensitive === true || aiResponse.isSensitive === true) {
    return {
      isSensitive: true,
      sensitiveDocumentType:
        aiResponse.sensitive_document_type || aiResponse.sensitiveDocumentType || null,
    };
  }

  const ocrSensitivity = resolveSensitivityFromOcrFields(aiResponse.ocr);
  if (ocrSensitivity) {
    return ocrSensitivity;
  }

  if (aiResponse.is_sensitive === false || aiResponse.isSensitive === false) {
    return { isSensitive: false, sensitiveDocumentType: null };
  }

  return { isSensitive: false, sensitiveDocumentType: null };
}

/**
 * Build analyze-image JSON for the client: mask sensitive OCR text when needed.
 * @param {object} payload Unmasked FastAPI analyze response (+ optional Express fields)
 * @param {{ sensitiveRegions?: Array<object> }} [context]
 */
function prepareAnalyzeResponseForClient(payload, context = {}) {
  if (!payload || typeof payload !== 'object') return payload;

  const sensitivity = resolveIsSensitiveFromAnalyze(payload);
  let next = applyResolvedSensitivityToAnalyzePayload(payload, sensitivity);

  if (sensitivity.isSensitive) {
    next = maskAnalyzePayloadForClient(next, {
      sensitiveRegions: context.sensitiveRegions || extractSensitiveRegions(payload),
    });
  }

  return stripSensitiveRegionsFromAnalyzePayload(next);
}

/**
 * Prefer unmasked analyze values for embedding when sensitive content was masked for the client.
 * @param {import('express').Request['body']} body
 * @param {object | null} unmaskedAnalyze
 * @param {boolean} isSensitive
 */
function resolveEmbeddingBody(body, unmaskedAnalyze, isSensitive) {
  if (!isSensitive || !unmaskedAnalyze || typeof unmaskedAnalyze !== 'object') {
    return body;
  }

  const next = { ...body };
  const rawOcr = unmaskedAnalyze.ocr_text || unmaskedAnalyze.ocrText;
  if (rawOcr && String(rawOcr).trim()) {
    next.ocrText = String(rawOcr).trim();
  }
  if (unmaskedAnalyze.caption && String(unmaskedAnalyze.caption).trim()) {
    next.caption = String(unmaskedAnalyze.caption).trim();
  }
  const rawFeatures =
    unmaskedAnalyze.distinctive_features || unmaskedAnalyze.distinctiveFeatures;
  if (rawFeatures && String(rawFeatures).trim() && body.distinctiveFeatures) {
    next.distinctiveFeatures = String(rawFeatures).trim();
  }
  return next;
}

function buildAiMetadata(aiResponse, { embeddingVector, embeddingModel, embeddingResolved } = {}) {
  const hasValidVector =
    embeddingResolved === true ||
    (Array.isArray(embeddingVector) && embeddingVector.length === 512);

  if (!aiResponse || typeof aiResponse !== 'object') {
    if (!hasValidVector) return {};
    return {
      pipelineVersion: 'analyze_v1',
      embeddingAvailable: true,
      embeddingModel: embeddingModel || 'gemini-embedding-2',
      embeddingDimension: embeddingVector.length,
      processedAt: new Date(),
    };
  }

  const models = aiResponse.models || {};
  const ocr = aiResponse.ocr || {};
  const ocrStatus = mapOcrStatusForMetadata(ocr.status);
  const ocrFields =
    ocr && typeof ocr === 'object' && Object.keys(ocr).length > 0 ? ocr : null;

  const objectBlock = aiResponse.object_detection || aiResponse.objectDetection || {};
  const objectStatus = mapObjectStatusForMetadata(objectBlock.status);
  const detectedObjects = mapDetectedObjects(aiResponse);

  const embeddingAvailable =
    embeddingResolved === true ||
    aiResponse.embedding_available === true ||
    aiResponse.embeddingAvailable === true;

  const metadata = {
    pipelineVersion: models.pipeline_version || models.pipelineVersion || 'analyze_v1',
    embeddingModel:
      embeddingModel || models.embedding || models.embeddingModel || 'gemini-embedding-2',
    embeddingDimension:
      models.embedding_dimension ??
      models.embeddingDimension ??
      aiResponse.embedding_dimension ??
      aiResponse.embeddingDimension ??
      512,
    embeddingAvailable,
    captionModel: models.caption || models.captionModel || '',
    ocrModel: models.ocr || 'unknown',
    objectModel: models.object || objectBlock.model || '',
    ocrStatus: OCR_STATUS_VALUES.includes(ocrStatus) ? ocrStatus : 'skipped',
    objectStatus: OBJECT_STATUS_VALUES.includes(objectStatus) ? objectStatus : 'skipped',
    detectionCount: detectedObjects.length,
    ocrFields,
    processedAt: new Date(),
    processingTimeMs: aiResponse.processing_time_ms ?? aiResponse.processingTimeMs ?? 0,
  };

  const suggestion = resolveSuggestedCategory({
    detectedObjects,
    analyzePayload: aiResponse,
    ocr: aiResponse?.ocr,
  });
  if (suggestion?.category) {
    metadata.suggestedCategory = suggestion.category;
    metadata.suggestedCategorySource = suggestion.source;
    if (suggestion.documentType) {
      metadata.ocrDocumentType = suggestion.documentType;
    }
  }

  const sensitivity = resolveIsSensitiveFromAnalyze(aiResponse);
  metadata.isSensitive = sensitivity.isSensitive;
  if (sensitivity.sensitiveDocumentType) {
    metadata.sensitiveDocumentType = sensitivity.sensitiveDocumentType;
  }

  const sensitiveRegions = extractSensitiveRegions(aiResponse);
  if (sensitiveRegions.length > 0) {
    metadata.sensitiveRegions = sensitiveRegions;
  }

  return metadata;
}

function validateCreateItemFields(body) {
  const required = [
    ['title', body.title],
    ['category', body.category],
    ['locationName', body.locationName],
    ['date', body.date],
    ['reportType', body.reportType],
  ];

  for (const [field, value] of required) {
    if (value == null || String(value).trim() === '') {
      return { error: `${field} is required` };
    }
  }

  if (!REPORT_TYPES.includes(body.reportType)) {
    return { error: 'reportType must be lost or found' };
  }

  if (!CATEGORIES.includes(body.category)) {
    return { error: 'Invalid category' };
  }

  if (body.userCategory != null && body.userCategory !== '' && !CATEGORIES.includes(body.userCategory)) {
    return { error: 'Invalid userCategory' };
  }

  const location = parseLocation(body);
  if (!location) {
    return { error: 'location.coordinates is required ([longitude, latitude])' };
  }

  const secondaryLocation = parseGeoPoint(body.secondaryLocation);
  const contactPreference = CONTACT_PREFERENCES.includes(body.contactPreference)
    ? body.contactPreference
    : 'in_app_chat';

  return { location, secondaryLocation, contactPreference };
}

function buildImageFormData(file, extraFields = {}) {
  const formData = new FormData();
  const blob = new Blob([file.buffer], { type: file.mimetype });
  formData.append('image', blob, file.originalname || 'image.jpg');
  for (const [key, value] of Object.entries(extraFields)) {
    if (value != null && value !== '') {
      formData.append(key, String(value));
    }
  }
  return formData;
}

async function extractOcr(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const documentType = (req.body?.document_type || 'auto').trim().toLowerCase();
    const formData = buildImageFormData(req.file, { document_type: documentType });
    const data = await postMultipart('/api/v1/ocr/extract', formData, {
      timeout: OCR_TIMEOUT_MS,
    });
    return res.status(200).json(stripSensitiveRegionsFromAnalyzePayload(data));
  } catch (err) {
    const mapped = mapAiServiceError(err);
    if (mapped.status === 503) {
      return res.status(503).json(mapped.body);
    }
    if (mapped.status === 422) {
      return res.status(422).json(mapped.body);
    }
    return next(err);
  }
}

async function processImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const formData = buildImageFormData(req.file, {
      category: req.body?.category || '',
      location: req.body?.location || '',
    });
    const data = await postMultipart('/ai/process-image', formData, {
      timeout: DEFAULT_TIMEOUT_MS,
    });
    return res.status(200).json(data);
  } catch (err) {
    const mapped = mapAiServiceError(err);
    if (mapped.status === 503) {
      return res.status(503).json(mapped.body);
    }
    return next(err);
  }
}

async function analyzeImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const documentType = (req.body?.document_type || 'auto').trim().toLowerCase();
    const formData = buildImageFormData(req.file, {
      category: req.body?.category || '',
      location: req.body?.location || '',
      document_type: documentType,
      title: req.body?.title || '',
      description: req.body?.description || '',
    });
    const data = await callAnalyzeImage(formData);
    const sensitivity = resolveIsSensitiveFromAnalyze(data);
    const normalizedData = applyResolvedSensitivityToAnalyzePayload(data, sensitivity);
    const sensitiveRegions = extractSensitiveRegions(normalizedData);
    if (sensitiveRegions.length > 0) {
      stashSensitiveRegions(req.user.userId, sensitiveRegions);
    }
    if (sensitivity.isSensitive) {
      stashAnalyzePayload(req.user.userId, normalizedData);
    }
    const visionStatus = normalizedData?.vision_status || normalizedData?.visionStatus || 'unknown';
    const captionWords = (normalizedData?.caption || '').trim().split(/\s+/).filter(Boolean).length;
    const detectedObjects = mapDetectedObjects(normalizedData);
    const suggestion = resolveSuggestedCategory({
      detectedObjects,
      analyzePayload: normalizedData,
      ocr: normalizedData?.ocr,
    });
    console.info(
      `[analyzeImage] vision_status=${visionStatus} caption_words=${captionWords} ` +
        `ocr_success=${Boolean(normalizedData?.ocr?.success)} sensitive=${sensitivity.isSensitive} ` +
        `sensitive_type=${sensitivity.sensitiveDocumentType || 'none'} ` +
        `suggested_category=${suggestion?.category || 'none'} ` +
        `source=${suggestion?.source || 'none'} message=${JSON.stringify(normalizedData?.vision_message || '')}`,
    );
    return res.status(200).json(
      prepareAnalyzeResponseForClient(
        {
          ...normalizedData,
          suggestedCategory: suggestion?.category ?? null,
          suggestedCategorySource: suggestion?.source ?? null,
          suggestedCategoryHint: suggestion?.label ?? null,
          ocrDocumentType: suggestion?.documentType ?? normalizedData?.ocr?.document_type ?? null,
        },
        { sensitiveRegions },
      ),
    );
  } catch (err) {
    const mapped = mapAiServiceError(err);
    if (mapped.status === 503) {
      return res.status(503).json(mapped.body);
    }
    if (mapped.status === 422) {
      return res.status(422).json(mapped.body);
    }
    return next(err);
  }
}

async function createItem(req, res, next) {
  try {
    const validation = validateCreateItemFields(req.body);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const { location, secondaryLocation, contactPreference } = validation;
    let imageFileId = req.body.imageFileId || null;
    const colors = parseColors(req.body.colors);

    const clientEmbedding = parseEmbeddingVector(req.body.embeddingVector);
    const stashedAnalyze = takeAnalyzePayload(req.user.userId);
    const clientAnalyze = parseAnalyzeResult(req);
    const stashedRegions = takeSensitiveRegions(req.user.userId);

    const analyzeContext = await resolveCreateItemAnalyzeContext(req, {
      stashedAnalyze,
      clientAnalyze,
      stashedRegions,
      buildImageFormData,
      resolveIsSensitiveFromAnalyze,
    });

    const aiResponse = analyzeContext.aiResponse;
    const sensitiveRegions = analyzeContext.sensitiveRegions;
    const sensitivity = resolveIsSensitiveFromAnalyze(aiResponse);
    const unmaskedAnalyzeForEmbed =
      stashedAnalyze || (analyzeContext.analyzedOnCreate ? aiResponse : null);

    if (sensitivity.isSensitive && !req.file && req.body.imageFileId) {
      return res.status(400).json({
        error:
          'Sensitive document reports require a new photo upload so privacy masking can be applied.',
      });
    }

    if (req.file) {
      let uploadBuffer = req.file.buffer;
      let imagePrivacyMasked = false;

      if (sensitivity.isSensitive) {
        const protectedImage = await protectSensitiveImage(req.file.buffer, {
          sensitiveRegions,
          analyzePayload: aiResponse,
          mimeType: req.file.mimetype,
        });
        uploadBuffer = protectedImage.buffer;
        imagePrivacyMasked = protectedImage.imagePrivacyMasked;
        console.info(
          '[item] privacy mask applied user=%s strategy=%s regions=%d',
          req.user.userId,
          protectedImage.strategy,
          sensitiveRegions.length,
        );
        req._imageMaskStrategy = protectedImage.strategy;
      }

      imageFileId = await uploadToGridFS(
        uploadBuffer,
        req.file.originalname || 'image.jpg',
        req.file.mimetype,
      );

      req._imagePrivacyMasked = imagePrivacyMasked;
    }

    const detectedObjects = mapDetectedObjects(aiResponse);

    const userCategoryInput = req.body.userCategory?.trim() || req.body.category;
    let categoryFields;
    try {
      categoryFields = resolveCategoryFields({
        userCategory: userCategoryInput,
        detectedObjects,
        aiResponse,
      });
    } catch (catErr) {
      return res.status(400).json({ error: catErr.message || 'Invalid category' });
    }

    if (categoryFields.categoryMismatch) {
      console.warn(
        '[item] category mismatch user=%s ai=%s effective=%s confidence=%s item_title=%s',
        categoryFields.userCategory,
        categoryFields.aiCategory,
        categoryFields.effectiveCategory,
        categoryFields.categoryDetectionConfidence,
        String(req.body.title || '').trim(),
      );
    }

    const { vector: embeddingVector, available: embeddingResolved, model: embeddingModel } =
      await resolveItemEmbedding({
        body: resolveEmbeddingBody(
          { ...req.body, category: categoryFields.effectiveCategory },
          unmaskedAnalyzeForEmbed,
          sensitivity.isSensitive,
        ),
        file: req.file,
        aiResponse,
        clientVector: clientEmbedding,
        detectedObjects,
      });

    const aiMetadata = buildAiMetadata(aiResponse, {
      embeddingVector,
      embeddingModel,
      embeddingResolved,
    });
    if (sensitiveRegions.length && !aiMetadata.sensitiveRegions?.length) {
      aiMetadata.sensitiveRegions = sensitiveRegions;
    }
    if (req._imagePrivacyMasked) {
      aiMetadata.imagePrivacyMasked = true;
    }
    if (req._imageMaskStrategy) {
      aiMetadata.imageMaskStrategy = req._imageMaskStrategy;
    }
    const embeddingAvailable = embeddingResolved === true;

    const secondaryLocationName =
      secondaryLocation && req.body.secondaryLocationName
        ? String(req.body.secondaryLocationName).trim()
        : undefined;

    const itemPayload = {
      ownerId: req.user.userId,
      reportType: req.body.reportType,
      title: String(req.body.title).trim(),
      brand: req.body.brand ? String(req.body.brand).trim() : undefined,
      colors,
      category: categoryFields.category,
      userCategory: categoryFields.userCategory,
      aiCategory: categoryFields.aiCategory,
      effectiveCategory: categoryFields.effectiveCategory,
      categoryMismatch: categoryFields.categoryMismatch,
      categoryDetectionConfidence: categoryFields.categoryDetectionConfidence,
      locationName: String(req.body.locationName).trim(),
      distinctiveFeatures: req.body.distinctiveFeatures
        ? String(req.body.distinctiveFeatures).trim()
        : undefined,
      contactPreference,
      date: req.body.date,
      description: req.body.description ? String(req.body.description).trim() : undefined,
      caption: req.body.caption ? String(req.body.caption).trim() : undefined,
      ocrText: req.body.ocrText ? String(req.body.ocrText).trim() : undefined,
      location,
      imageFileId: imageFileId || null,
      embeddingVector: embeddingVector || null,
      embeddingAvailable,
      aiMetadata,
    };

    if (detectedObjects.length > 0) {
      itemPayload.detectedObjects = detectedObjects;
    }

    if (secondaryLocation) {
      itemPayload.secondaryLocation = secondaryLocation;
      if (secondaryLocationName) itemPayload.secondaryLocationName = secondaryLocationName;
    }

    const privacyApplied = applyPublicTextPrivacy(itemPayload, aiMetadata, {
      isSensitive: sensitivity.isSensitive,
      sensitiveRegions,
    });
    const securedItemPayload = privacyApplied.itemPayload;
    const securedAiMetadata = privacyApplied.aiMetadata;
    securedItemPayload.aiMetadata = securedAiMetadata;

    const item = await Item.create(securedItemPayload);

    res.status(201).json({ itemId: item._id });

    setImmediate(() => {
      triggerMatchingWithRetry(item).catch(console.error);
    });

    return undefined;
  } catch (err) {
    return next(err);
  }
}

async function getItems(req, res, next) {
  try {
    const { category, reportType, ownerId, status, q } = req.query;
    const page = req.query.page ?? 1;
    const limit = req.query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter = buildItemsListFilter({ category, reportType, ownerId, status, q });

    const [items, total] = await Promise.all([
      Item.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Item.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      items: items.map((row) => stripSensitiveMetadataFromItem(applyResolvedCategoryToItem(row))),
      total,
      page,
      totalPages,
    });
  } catch (err) {
    return next(err);
  }
}

async function getItemById(req, res, next) {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      isDeleted: { $ne: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    return res.status(200).json(stripSensitiveMetadataFromItem(applyResolvedCategoryToItem(item)));
  } catch (err) {
    return next(err);
  }
}

async function streamImage(req, res, next) {
  try {
    const item = await Item.findById(req.params.id);

    if (!item || item.isDeleted) {
      return res.status(404).json({ error: 'Item not found' });
    }
    if (!item.imageFileId) {
      return res.status(404).json({ error: 'No image for this item' });
    }

    const fileId = item.imageFileId;
    const downloadStream = getImageStream(fileId);

    downloadStream.on('file', (file) => {
      if (file?.contentType) {
        res.set('Content-Type', file.contentType);
      } else {
        res.set('Content-Type', 'image/jpeg');
      }
    });

    downloadStream.on('error', (err) => {
      if (err.code === 'ENOENT' || err.name === 'MongoRuntimeError') {
        return res.status(404).json({ error: 'Image file not found' });
      }
      return next(err);
    });

    if (!res.getHeader('Content-Type')) {
      res.set('Content-Type', 'image/jpeg');
    }
    downloadStream.pipe(res);
    return undefined;
  } catch (err) {
    return next(err);
  }
}

const ITEM_STATUSES = ['active', 'claimed', 'expired', 'returned'];

async function deleteItem(req, res, next) {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      ownerId: req.user.userId,
    });

    if (!item || item.isDeleted) {
      return res.status(404).json({ error: 'Item not found' });
    }

    item.isDeleted = true;
    await item.save();

    if (item.imageFileId) {
      await deleteFromGridFS(item.imageFileId);
    }

    return res.status(200).json({ message: 'Item deleted' });
  } catch (err) {
    return next(err);
  }
}

/**
 * Update owner-editable report fields without replacing the image or AI provenance.
 * Rebuild the semantic embedding from the final edited text when the AI service is available.
 */
async function updateItem(req, res, next) {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      ownerId: req.user.userId,
      isDeleted: { $ne: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const has = (key) => Object.prototype.hasOwnProperty.call(req.body, key);
    const optionalText = (key) => {
      const value = req.body[key];
      return value == null || String(value).trim() === '' ? undefined : String(value).trim();
    };

    if (has('reportType')) item.reportType = req.body.reportType;
    if (has('title')) item.title = String(req.body.title).trim();
    if (has('brand')) item.brand = optionalText('brand');
    if (has('colors')) item.colors = parseColors(req.body.colors);
    if (has('locationName')) item.locationName = String(req.body.locationName).trim();
    if (has('secondaryLocationName')) {
      item.secondaryLocationName = optionalText('secondaryLocationName');
    }
    if (has('date')) item.date = req.body.date;
    if (has('description')) item.description = optionalText('description');
    if (has('distinctiveFeatures')) {
      item.distinctiveFeatures = optionalText('distinctiveFeatures');
    }
    if (has('contactPreference')) item.contactPreference = req.body.contactPreference;

    if (has('category')) {
      const categoryFields = resolveCategoryFields({
        userCategory: req.body.category,
        detectedObjects: item.detectedObjects || [],
        aiResponse: {
          aiMetadata: item.aiMetadata || {},
          suggestedCategory: item.aiCategory || item.aiMetadata?.suggestedCategory,
        },
      });
      item.category = categoryFields.category;
      item.userCategory = categoryFields.userCategory;
      item.aiCategory = categoryFields.aiCategory;
      item.effectiveCategory = categoryFields.effectiveCategory;
      item.categoryMismatch = categoryFields.categoryMismatch;
      item.categoryDetectionConfidence = categoryFields.categoryDetectionConfidence;
    }

    const finalBody = {
      category: item.effectiveCategory || item.category,
      locationName: item.locationName,
      title: item.title,
      description: item.description,
      distinctiveFeatures: item.distinctiveFeatures,
      brand: item.brand,
      colors: item.colors,
      caption: item.caption,
      ocrText: item.ocrText,
    };
    const embedding = await resolveItemEmbedding({
      body: finalBody,
      file: null,
      aiResponse: null,
      clientVector: item.embeddingVector,
      detectedObjects: item.detectedObjects || [],
    });
    if (embedding.available && embedding.vector) {
      item.embeddingVector = embedding.vector;
      item.embeddingAvailable = true;
      item.aiMetadata = {
        ...(item.aiMetadata?.toObject?.() || item.aiMetadata || {}),
        embeddingAvailable: true,
        embeddingModel:
          embedding.model || item.aiMetadata?.embeddingModel || 'gemini-embedding-2',
        embeddingDimension: embedding.dimension || embedding.vector.length,
        processedAt: new Date(),
      };
    }

    await item.save();

    setImmediate(() => {
      triggerMatchingWithRetry(item).catch(console.error);
    });

    return res
      .status(200)
      .json(stripSensitiveMetadataFromItem(applyResolvedCategoryToItem(item)));
  } catch (err) {
    return next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const item = await Item.findById(req.params.id);

    if (!item || item.isDeleted) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { status, claimedByUserId } = req.body;

    if (!ITEM_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const update = { status };

    if (status === 'claimed') {
      update.claimedAt = new Date();
      update.claimedByUserId = claimedByUserId || null;
      update.returnedAt = null;
    } else if (status === 'returned') {
      update.returnedAt = new Date();
      update.claimedAt = update.returnedAt;
      update.claimedByUserId = claimedByUserId || null;
    } else {
      update.claimedAt = null;
      update.claimedByUserId = null;
      update.returnedAt = null;
    }

    const updated = await Item.findByIdAndUpdate(req.params.id, update, { new: true });

    return res.status(200).json(updated);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  extractOcr,
  processImage,
  analyzeImage,
  createItem,
  getItems,
  getItemById,
  streamImage,
  deleteItem,
  updateItem,
  updateStatus,
};
