/**
 * Phase 3 — blur sensitive OCR regions on item images before GridFS storage.
 *
 * Uses bounding boxes from Phase 2 (OCR coordinate space) scaled to the uploaded
 * image dimensions (OCR runs on max 1024px long edge in ai-server).
 */

const sharp = require('sharp');

/** Must match ai-server ``resize_image`` default (utils/image_utils.py). */
const MAX_OCR_LONG_EDGE = 1024;
/** Gaussian sigma per pass on sensitive regions (higher = stronger obfuscation). */
const BLUR_SIGMA = 50;
/** Passes applied to each masked patch — multi-pass makes digits much harder to recover. */
const REGION_BLUR_PASSES = 2;
/** Full-image fallback blur when no OCR boxes exist. */
const FULL_IMAGE_BLUR_SIGMA = 55;
/** Expand each OCR box slightly so blur covers anti-aliased digit edges. */
const BOX_PADDING_PX = 8;

const FULL_MASK_FIELDS = new Set(['card_number', 'expiry_date', 'cvc', 'document']);

/**
 * @param {number} width
 * @param {number} height
 */
function ocrToImageScale(width, height) {
  const longEdge = Math.max(width, height);
  if (longEdge <= MAX_OCR_LONG_EDGE) return 1;
  return longEdge / MAX_OCR_LONG_EDGE;
}

/**
 * @param {number[]} box
 * @param {number} width
 * @param {number} height
 */
function clampExtractRect(box, width, height) {
  const x1 = Math.min(box[0], box[2]);
  const y1 = Math.min(box[1], box[3]);
  const x2 = Math.max(box[0], box[2]);
  const y2 = Math.max(box[1], box[3]);

  const left = Math.max(0, Math.min(width - 1, Math.round(x1)));
  const top = Math.max(0, Math.min(height - 1, Math.round(y1)));
  const right = Math.max(left + 1, Math.min(width, Math.round(x2)));
  const bottom = Math.max(top + 1, Math.min(height, Math.round(y2)));

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * @param {object} region
 * @returns {Array<{ box: number[], partial: boolean }>}
 */
function planMaskTargets(region) {
  const field = String(region.field || '').trim();
  const boxes = Array.isArray(region.boundingBoxes)
    ? [...region.boundingBoxes].sort((a, b) => a[0] - b[0])
    : [];

  if (boxes.length === 0) return [];

  if (FULL_MASK_FIELDS.has(field)) {
    return boxes.map((box) => ({ box, partial: false }));
  }

  return boxes.map((box) => ({ box, partial: false }));
}

/**
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {number} padding
 */
function expandExtractRect(rect, imageWidth, imageHeight, padding) {
  const left = Math.max(0, rect.left - padding);
  const top = Math.max(0, rect.top - padding);
  const right = Math.min(imageWidth, rect.left + rect.width + padding);
  const bottom = Math.min(imageHeight, rect.top + rect.height + padding);
  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

/**
 * @param {import('sharp').Sharp} pipeline
 * @param {number} sigma
 * @param {number} passes
 */
function applyStrongBlur(pipeline, sigma, passes) {
  let next = pipeline;
  for (let pass = 0; pass < passes; pass += 1) {
    next = next.blur(sigma);
  }
  return next;
}

/**
 * @param {import('sharp').Sharp} baseImage
 * @param {{ box: number[], partial: boolean }} target
 * @param {number} scale
 * @param {number} imageWidth
 * @param {number} imageHeight
 */
async function buildMaskedPatch(baseImage, target, scale, imageWidth, imageHeight) {
  const scaledBox = target.box.map((value) => Math.round(Number(value) * scale));
  const rect = expandExtractRect(
    clampExtractRect(scaledBox, imageWidth, imageHeight),
    imageWidth,
    imageHeight,
    BOX_PADDING_PX,
  );

  const blurred = await applyStrongBlur(
    baseImage.clone().extract({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    }),
    BLUR_SIGMA,
    REGION_BLUR_PASSES,
  ).toBuffer();

  return {
    input: blurred,
    left: rect.left,
    top: rect.top,
  };
}

/**
 * Encode image buffer to JPEG/PNG (never returns the original buffer unchanged).
 * @param {import('sharp').Sharp} pipeline
 * @param {string} mimeType
 */
async function finalizeImageBuffer(pipeline, mimeType) {
  if (String(mimeType).toLowerCase().includes('png')) {
    return pipeline.png().toBuffer();
  }
  return pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

/**
 * Blur the full image — last-resort fallback when no document boxes exist.
 * @param {Buffer} buffer
 * @param {string} mimeType
 */
async function maskFullImage(buffer, mimeType = 'image/jpeg') {
  const pipeline = applyStrongBlur(
    sharp(buffer, { failOn: 'none' }),
    FULL_IMAGE_BLUR_SIGMA,
    REGION_BLUR_PASSES,
  );
  return finalizeImageBuffer(pipeline, mimeType);
}

/**
 * Blur a central document area (~85% of frame) when OCR boxes are missing.
 * @param {Buffer} buffer
 * @param {string} mimeType
 */
async function maskCentralDocumentArea(buffer, mimeType = 'image/jpeg') {
  const baseImage = sharp(buffer, { failOn: 'none' });
  const meta = await baseImage.metadata();
  const imageWidth = meta.width || 0;
  const imageHeight = meta.height || 0;
  if (!imageWidth || !imageHeight) {
    return maskFullImage(buffer, mimeType);
  }

  const marginX = Math.round(imageWidth * 0.075);
  const marginY = Math.round(imageHeight * 0.075);
  const centralBox = [
    marginX,
    marginY,
    imageWidth - marginX,
    imageHeight - marginY,
  ];

  return maskSensitiveImage(
    buffer,
    [
      {
        field: 'document',
        label: 'Document',
        text: '',
        boundingBoxes: [centralBox],
        confidence: 0,
      },
    ],
    mimeType,
  );
}

/**
 * Apply privacy masking for sensitive uploads. Never returns the original buffer.
 *
 * Fallback order:
 * 1. Phase 2 sensitive_regions (precise)
 * 2. OCR field/detection bounding boxes from analyze payload
 * 3. Central document-area blur
 * 4. Full-image blur
 *
 * @param {Buffer} buffer
 * @param {{ sensitiveRegions?: Array<object>, analyzePayload?: object | null, mimeType?: string }} options
 * @returns {Promise<{ buffer: Buffer, strategy: string, imagePrivacyMasked: boolean }>}
 */
async function protectSensitiveImage(
  buffer,
  { sensitiveRegions = [], analyzePayload = null, mimeType = 'image/jpeg' } = {},
) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Sensitive image protection requires a valid image buffer.');
  }

  const { buildFallbackMaskRegionsFromAnalyze } = require('./sensitiveOcrRegions');

  let regions = Array.isArray(sensitiveRegions) ? sensitiveRegions.filter(Boolean) : [];
  let strategy = 'sensitive_regions';

  if (!regions.length) {
    const fallbackRegions = buildFallbackMaskRegionsFromAnalyze(analyzePayload);
    if (fallbackRegions.length) {
      regions = fallbackRegions;
      strategy = 'ocr_bbox_fallback';
    }
  }

  if (regions.length) {
    const masked = await maskSensitiveImage(buffer, regions, mimeType);
    return {
      buffer: masked,
      strategy,
      imagePrivacyMasked: true,
    };
  }

  const centralMasked = await maskCentralDocumentArea(buffer, mimeType);
  return {
    buffer: centralMasked,
    strategy: 'central_document',
    imagePrivacyMasked: true,
  };
}

/**
 * Mask sensitive values on an uploaded image buffer.
 *
 * @param {Buffer} buffer
 * @param {Array<object>} sensitiveRegions
 * @param {string} [mimeType]
 * @returns {Promise<Buffer>}
 */
async function maskSensitiveImage(buffer, sensitiveRegions, mimeType = 'image/jpeg') {
  if (!buffer || !Buffer.isBuffer(buffer) || !Array.isArray(sensitiveRegions)) {
    throw new Error('maskSensitiveImage requires a buffer and region list.');
  }
  if (sensitiveRegions.length === 0) {
    throw new Error('maskSensitiveImage requires at least one sensitive region.');
  }

  const baseImage = sharp(buffer, { failOn: 'none' });
  const meta = await baseImage.metadata();
  const imageWidth = meta.width || 0;
  const imageHeight = meta.height || 0;
  if (!imageWidth || !imageHeight) {
    return maskFullImage(buffer, mimeType);
  }

  const scale = ocrToImageScale(imageWidth, imageHeight);
  const composites = [];

  for (const region of sensitiveRegions) {
    const targets = planMaskTargets(region);
    for (const target of targets) {
      composites.push(
        await buildMaskedPatch(baseImage, target, scale, imageWidth, imageHeight),
      );
    }
  }

  if (composites.length === 0) {
    return maskCentralDocumentArea(buffer, mimeType);
  }

  const pipeline = baseImage.composite(composites);
  return finalizeImageBuffer(pipeline, mimeType);
}

module.exports = {
  maskSensitiveImage,
  protectSensitiveImage,
  maskFullImage,
  maskCentralDocumentArea,
  ocrToImageScale,
  planMaskTargets,
  MAX_OCR_LONG_EDGE,
  BLUR_SIGMA,
  REGION_BLUR_PASSES,
  FULL_IMAGE_BLUR_SIGMA,
};
