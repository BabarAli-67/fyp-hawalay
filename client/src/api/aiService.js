import axiosInstance from './axiosInstance.js';

const AI_TIMEOUT_MS = 20_000;
// Must cover Express → FastAPI OCR + Gemini (429 retries can add ~20s+).
const ANALYZE_IMAGE_TIMEOUT_MS = 90_000;
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
 * Unified OCR + Gemini caption + embeddings via Express → FastAPI `/ai/analyze-image`.
 *
 * @param {FormData} formData - image, category, location, document_type
 */
export async function analyzeImage(formData) {
  // Single attempt — do not retry on timeout (server may still be processing).
  const { data } = await axiosInstance.post('/api/items/analyze-image', formData, {
    timeout: ANALYZE_IMAGE_TIMEOUT_MS,
  });

  return data;
}

/**
 * BLIP caption + CLIP embedding via Express → FastAPI `/ai/process-image`.
 */
export async function processItemImage(file, { category = '', location = '' } = {}) {
  const formData = new FormData();
  formData.append('image', file);
  if (category) formData.append('category', category);
  if (location) formData.append('location', location);

  const { data } = await withRetry(() =>
    axiosInstance.post('/api/items/process-image', formData, { timeout: AI_TIMEOUT_MS }),
  );

  return data;
}
