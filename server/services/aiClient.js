/**
 * Express → FastAPI HTTP client (timeout + single retry on transient failures).
 */
const axios = require('axios');

const DEFAULT_TIMEOUT_MS = 15_000;
const OCR_TIMEOUT_MS = 65_000;
// OCR + Gemini caption/features + 429 retry sleeps can exceed 30s (see gemini_retry).
const ANALYZE_IMAGE_TIMEOUT_MS = 90_000;
const RETRY_DELAY_MS = 800;
const MAX_RETRIES = 1;

if (process.env.INTERNAL_SECRET === undefined) {
  console.warn(
    '[aiClient] INTERNAL_SECRET is not defined — FastAPI protected routes may return 401',
  );
}

const fastApiClient = axios.create({
  headers: {
    'X-Internal-Secret': String(process.env.INTERNAL_SECRET || '').trim(),
  },
});

function getFastApiBase() {
  const base = process.env.FASTAPI_URL?.trim().replace(/\/$/, '');
  if (!base) {
    const err = new Error('AI service unavailable');
    err.code = 'FASTAPI_NOT_CONFIGURED';
    throw err;
  }
  return base;
}

function isRetryableError(err) {
  if (err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return true;
  }
  const status = err.response?.status;
  return typeof status === 'number' && status >= 500 && status < 600;
}

async function withRetry(requestFn, retries = MAX_RETRIES) {
  try {
    return await requestFn();
  } catch (err) {
    if (retries > 0 && isRetryableError(err)) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return withRetry(requestFn, retries - 1);
    }
    throw err;
  }
}

/**
 * POST multipart form to FastAPI (browser never calls FastAPI directly).
 *
 * @param {string} path - e.g. `/api/v1/ocr/extract`
 * @param {FormData} formData
 * @param {{ timeout?: number }} options
 * @returns {Promise<object>} Parsed JSON body
 */
async function postMultipart(path, formData, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const base = getFastApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await withRetry(() =>
    fastApiClient.post(url, formData, {
      timeout,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }),
  );

  return response.data;
}

/**
 * POST multipart to FastAPI unified analyze pipeline (OCR + Gemini caption + embeddings).
 *
 * @param {FormData} formData - image, category, location, document_type
 * @param {{ timeout?: number }} options
 * @returns {Promise<object>} Parsed JSON body (ocr, caption, embedding_vector, ...)
 */
async function analyzeImage(formData, { timeout = ANALYZE_IMAGE_TIMEOUT_MS } = {}) {
  const data = await postMultipart('/ai/analyze-image', formData, { timeout });
  const visionStatus = data?.vision_status || 'unknown';
  const captionWords = (data?.caption || '').trim().split(/\s+/).filter(Boolean).length;
  console.info(
    `[aiClient] analyze-image response vision_status=${visionStatus} caption_words=${captionWords}`,
  );
  return data;
}

/**
 * Build matching embedding from final report fields (manual / AI / mixed).
 *
 * @param {FormData} formData
 * @param {{ timeout?: number }} options
 */
async function embedItemReport(formData, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  return postMultipart('/ai/embed-item', formData, { timeout });
}

/**
 * POST JSON body to FastAPI (browser never calls FastAPI directly).
 *
 * @param {string} path - e.g. `/ai/match`
 * @param {object} body
 * @param {{ timeout?: number }} options
 * @returns {Promise<object>} Parsed JSON body
 */
async function postJson(path, body, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const base = getFastApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fastApiClient.post(url, body, {
    timeout,
    headers: { 'Content-Type': 'application/json' },
  });

  return response.data;
}

function mapAiServiceError(err) {
  if (err.code === 'FASTAPI_NOT_CONFIGURED') {
    return { status: 503, body: { error: 'AI service unavailable', fallback: true } };
  }

  const status = err.response?.status;
  const isTimeout = err.code === 'ECONNABORTED';
  const is5xx = typeof status === 'number' && status >= 500 && status < 600;
  const isUnreachable = !err.response && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND');

  if (isUnreachable) {
    return {
      status: 503,
      body: {
        error: 'AI server is not running. Start ai-server on port 8000 (python main.py).',
        fallback: true,
      },
    };
  }

  if (isTimeout || is5xx) {
    return { status: 503, body: { error: 'AI service unavailable', fallback: true } };
  }

  if (status === 422) {
    return {
      status: 422,
      body: { error: err.response?.data?.detail || 'Invalid image file' },
    };
  }

  return {
    status: status || 502,
    body: { error: err.response?.data?.detail || err.message || 'AI request failed' },
  };
}

/**
 * Log whether FastAPI is reachable (call once after Express starts).
 */
async function probeFastApiHealth() {
  let base;
  try {
    base = getFastApiBase();
  } catch {
    console.error('[aiClient] FASTAPI_URL is not configured — analyze-image will return 503');
    return;
  }

  const url = `${base}/health`;
  try {
    const res = await fastApiClient.get(url, { timeout: 5_000 });
    const ocrReady = res.data?.ocr_ready;
    const gemini = res.data?.gemini_configured;
    const geminiClient = res.data?.gemini_client_initialized;
    const keySuffix = res.data?.gemini_key_suffix || '?';
    console.info(
      `[aiClient] FastAPI OK at ${base} (ocr_ready=${ocrReady}, gemini_configured=${gemini}, ` +
        `gemini_client_initialized=${geminiClient}, key=${keySuffix})`,
    );
    if (!ocrReady) {
      console.warn('[aiClient] FastAPI is up but OCR models are still loading — wait before uploads');
    }
  } catch (err) {
    console.error(
      `[aiClient] FastAPI unreachable at ${url} — start ai-server: cd ai-server && python main.py`,
    );
    if (err.code) console.error(`[aiClient]   (${err.code})`);
  }
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  OCR_TIMEOUT_MS,
  ANALYZE_IMAGE_TIMEOUT_MS,
  getFastApiBase,
  postMultipart,
  postJson,
  analyzeImage,
  embedItemReport,
  mapAiServiceError,
  probeFastApiHealth,
};
