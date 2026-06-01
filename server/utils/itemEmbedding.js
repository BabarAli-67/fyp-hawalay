/**
 * Build item matching fingerprint at submit time (manual, AI, or mixed reports).
 *
 * --- FLOW 1 regression (2026-05-29, node scripts/regression-flow1-e2e.js) ---
 * (a) POST /ai/analyze-image → embedding_vector: null, embedding_available: false — PASS
 * (b) POST /ai/embed-item (resolveItemEmbedding / aiClient) → 512-d, embedding_available: true — PASS
 * (c) POST /api/items → MongoDB item.embeddingVector 512-d, embeddingAvailable: true (not client 0.999 decoy) — PASS
 * (d) triggerMatching → [matching] background job started (0 candidates is OK) — PASS
 * Note: if querySrv ECONNREFUSED on WiFi, script uses 8.8.8.8/1.1.1.1 unless REGRESSION_USE_PUBLIC_DNS=0.
 * ---
 *
 * Embedding lifecycle:
 * (1) Created by FastAPI: preview at POST /ai/analyze-image (run_vision) and again at POST /ai/embed-item on submit.
 * (2) Built from final report text (build_enriched_text: category, title, description, caption, OCR, features, brand, colors) plus optional image bytes.
 * (3) Client stores preview in ReportPage state (embeddingVector) and analyzeSnapshot.raw.embedding_vector after analyze.
 * (4) Client sends preview on create as multipart field embeddingVector (JSON string) with POST /api/items.
 * (5) Express always calls /ai/embed-item first here; uses that vector if embedding_available, else falls back to client embeddingVector.
 */

const { embedItemReport } = require('../services/aiClient');

function parseJsonArray(raw) {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      return raw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function extractFeaturePoints(aiResponse) {
  if (!aiResponse || typeof aiResponse !== 'object') return [];
  if (Array.isArray(aiResponse.feature_points)) {
    return aiResponse.feature_points.map((p) => String(p).trim()).filter(Boolean);
  }
  if (Array.isArray(aiResponse.featurePoints)) {
    return aiResponse.featurePoints.map((p) => String(p).trim()).filter(Boolean);
  }
  const block = aiResponse.distinctive_features || aiResponse.distinctiveFeatures;
  if (typeof block === 'string' && block.trim()) {
    return block
      .split('\n')
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
}

function extractObjectLabels(aiResponse) {
  if (!aiResponse || typeof aiResponse !== 'object') return [];
  const block = aiResponse.object_detection || aiResponse.objectDetection;
  const list = block?.detected_objects || block?.detectedObjects || [];
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => row?.class_name || row?.className || '')
    .map((name) => String(name).trim())
    .filter(Boolean);
}

/**
 * @param {import('express').Request['body']} body
 * @param {object | null} aiResponse
 */
function appendEmbedFormFields(formData, body, aiResponse) {
  const append = (key, value) => {
    if (value != null && value !== '') formData.append(key, String(value));
  };

  append('category', body.category);
  append('location', body.locationName || body.location);
  append('title', body.title);
  append('description', body.description);
  append('distinctive_features', body.distinctiveFeatures);
  append('brand', body.brand);
  append('caption', body.caption);
  append('ocr_text', body.ocrText);

  const colors = parseJsonArray(body.colors);
  if (colors.length) append('colors', JSON.stringify(colors));

  const featurePoints = extractFeaturePoints(aiResponse);
  if (featurePoints.length) append('feature_points', JSON.stringify(featurePoints));

  const objectLabels = extractObjectLabels(aiResponse);
  if (objectLabels.length) append('object_labels', JSON.stringify(objectLabels));
}

/**
 * Resolve embedding at item create from final submitted fields (+ optional image).
 *
 * @returns {Promise<{ vector: number[] | null, available: boolean }>}
 */
async function resolveItemEmbedding({ body, file, aiResponse, clientVector }) {
  const formData = new FormData();
  appendEmbedFormFields(formData, body, aiResponse);

  if (file?.buffer) {
    const blob = new Blob([file.buffer], { type: file.mimetype || 'image/jpeg' });
    formData.append('image', blob, file.originalname || 'image.jpg');
  }

  try {
    const data = await embedItemReport(formData);
    const vector = data?.embedding_vector ?? data?.embeddingVector;
    const available = data?.embedding_available === true || data?.embeddingAvailable === true;
    if (available && Array.isArray(vector) && vector.length > 0) {
      console.log(
        'resolveItemEmbedding: analyze-time vector no longer provided; relying on embed-item',
      );
      return { vector, available: true };
    }
  } catch (err) {
    const detail = err.response?.data?.detail || err.response?.data?.error || err.message;
    console.warn('[itemEmbedding] embed-item failed:', detail);
  }

  if (Array.isArray(clientVector) && clientVector.length > 0) {
    return { vector: clientVector, available: true };
  }

  return { vector: null, available: false };
}

module.exports = {
  resolveItemEmbedding,
  extractFeaturePoints,
};
