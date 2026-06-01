/**
 * Normalize FastAPI OCR extract response for React UI.
 * Delegates to shared analyze normalizer when response includes full OCR block shape.
 */
import { normalizeOcrBlock } from './normalizeAnalyzeResponse.js';

export function normalizeOcrResponse(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }
  if (data.ocr) {
    return normalizeOcrBlock(data.ocr);
  }
  return normalizeOcrBlock(data);
}

export function formatConfidence(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Math.round(Number(value) * 100)}%`;
}
