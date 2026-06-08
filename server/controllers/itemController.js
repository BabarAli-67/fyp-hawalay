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
const { suggestCategoryFromDetections } = require('../utils/categoryMapping');
const { resolveItemEmbedding } = require('../utils/itemEmbedding');

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

function buildAiMetadata(aiResponse, { embeddingVector } = {}) {
  if (!aiResponse || typeof aiResponse !== 'object') {
    const hasVector = Array.isArray(embeddingVector) && embeddingVector.length > 0;
    if (!hasVector) return {};
    return {
      pipelineVersion: 'analyze_v1',
      embeddingAvailable: true,
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
    aiResponse.embedding_available === true ||
    aiResponse.embeddingAvailable === true ||
    (Array.isArray(embeddingVector) && embeddingVector.length > 0);

  const metadata = {
    pipelineVersion: models.pipeline_version || models.pipelineVersion || 'analyze_v1',
    embeddingModel: models.embedding || 'unknown',
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

  const suggestedCategory = suggestCategoryFromDetections(detectedObjects);
  if (suggestedCategory) {
    metadata.suggestedCategory = suggestedCategory;
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
    return res.status(200).json(data);
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
    const visionStatus = data?.vision_status || data?.visionStatus || 'unknown';
    const captionWords = (data?.caption || '').trim().split(/\s+/).filter(Boolean).length;
    console.info(
      `[analyzeImage] vision_status=${visionStatus} caption_words=${captionWords} ` +
        `ocr_success=${Boolean(data?.ocr?.success)} message=${JSON.stringify(data?.vision_message || '')}`,
    );
    const suggestedCategory = suggestCategoryFromDetections(mapDetectedObjects(data));
    return res.status(200).json({ ...data, suggestedCategory });
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

    if (req.file) {
      imageFileId = await uploadToGridFS(
        req.file.buffer,
        req.file.originalname || 'image.jpg',
        req.file.mimetype,
      );
    }

    const clientEmbedding = parseEmbeddingVector(req.body.embeddingVector);
    const aiResponse = parseAnalyzeResult(req);

    const { vector: embeddingVector, available: embeddingResolved } = await resolveItemEmbedding({
      body: req.body,
      file: req.file,
      aiResponse,
      clientVector: clientEmbedding,
    });

    const detectedObjects = mapDetectedObjects(aiResponse);
    const aiMetadata = buildAiMetadata(aiResponse, { embeddingVector });
    const embeddingAvailable =
      embeddingResolved === true || aiMetadata.embeddingAvailable === true;

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
      category: req.body.category,
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

    const item = await Item.create(itemPayload);

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

    const filter = { isDeleted: { $ne: true } };
    if (category) filter.category = category;
    if (reportType) filter.reportType = reportType;
    if (ownerId) filter.ownerId = ownerId;
    if (status) filter.status = status;

    const keyword = typeof q === 'string' ? q.trim() : '';
    if (keyword) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { title: regex },
        { description: regex },
        { locationName: regex },
        { brand: regex },
        { distinctiveFeatures: regex },
      ];
    }

    const [items, total] = await Promise.all([
      Item.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Item.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      items,
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

    return res.status(200).json(item);
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

const ITEM_STATUSES = ['active', 'claimed', 'expired'];

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
    } else {
      update.claimedAt = null;
      update.claimedByUserId = null;
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
  updateStatus,
};
