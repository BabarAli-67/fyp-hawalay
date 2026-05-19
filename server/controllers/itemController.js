const axios = require('axios');
const Item = require('../models/Item');
const { triggerMatching } = require('../services/matchingService');
const { getImageStream, uploadToGridFS } = require('../utils/imageStorage');

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

async function processImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const fastApiBase = process.env.FASTAPI_URL?.trim().replace(/\/$/, '');
    if (!fastApiBase) {
      return res.status(503).json({
        error: 'AI service unavailable',
        fallback: true,
      });
    }

    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('image', blob, req.file.originalname || 'image.jpg');

    try {
      const aiResponse = await axios.post(`${fastApiBase}/ai/process-image`, formData, {
        timeout: 15000,
      });
      return res.status(200).json(aiResponse.data);
    } catch (err) {
      const status = err.response?.status;
      const isTimeout = err.code === 'ECONNABORTED';
      const is5xx = typeof status === 'number' && status >= 500 && status < 600;

      if (isTimeout || is5xx || !err.response) {
        return res.status(503).json({
          error: 'AI service unavailable',
          fallback: true,
        });
      }

      return next(err);
    }
  } catch (err) {
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

    const embeddingVector = parseEmbeddingVector(req.body.embeddingVector);

    const secondaryLocationName = secondaryLocation && req.body.secondaryLocationName
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
    };

    if (secondaryLocation) {
      itemPayload.secondaryLocation = secondaryLocation;
      if (secondaryLocationName) itemPayload.secondaryLocationName = secondaryLocationName;
    }

    const item = await Item.create(itemPayload);

    res.status(201).json({ itemId: item._id });

    setImmediate(() => {
      triggerMatching(item).catch(console.error);
    });

    return undefined;
  } catch (err) {
    return next(err);
  }
}

async function getItems(req, res, next) {
  try {
    const { category, reportType, ownerId } = req.query;
    const page = req.query.page ?? 1;
    const limit = req.query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter = { isDeleted: false };
    if (category) filter.category = category;
    if (reportType) filter.reportType = reportType;
    if (ownerId) filter.ownerId = ownerId;

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
    const item = await Item.findById(req.params.id);

    if (!item || item.isDeleted) {
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

    downloadStream.on('error', (err) => {
      if (err.code === 'ENOENT' || err.name === 'MongoRuntimeError') {
        return res.status(404).json({ error: 'Image file not found' });
      }
      return next(err);
    });

    res.set('Content-Type', 'image/jpeg');
    downloadStream.pipe(res);
    return undefined;
  } catch (err) {
    return next(err);
  }
}

const ITEM_STATUSES = ['active', 'claimed', 'expired'];

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
  processImage,
  createItem,
  getItems,
  getItemById,
  streamImage,
  updateStatus,
};
