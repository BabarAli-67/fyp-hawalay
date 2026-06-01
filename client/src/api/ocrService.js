import axiosInstance from './axiosInstance.js';
import { normalizeOcrResponse } from '../utils/normalizeOcrResponse.js';

const OCR_TIMEOUT_MS = 65_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 800;

function isRetryable(error) {
  const status = error?.response?.status;
  return (
    !error?.response ||
    error.code === 'ECONNABORTED' ||
    (typeof status === 'number' && status >= 500)
  );
}

async function withRetry(requestFn) {
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await requestFn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === MAX_ATTEMPTS - 1) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  throw lastError;
}

/**
 * Structured document OCR via Express → FastAPI (never call FastAPI from browser).
 */
export async function extractDocumentOcr(file, { documentType = 'auto' } = {}) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('document_type', documentType);

  const { data } = await withRetry(() =>
    axiosInstance.post('/api/items/ocr', formData, { timeout: OCR_TIMEOUT_MS }),
  );

  return normalizeOcrResponse(data);
}
