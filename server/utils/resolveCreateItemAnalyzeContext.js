/**
 * Resolve analyze + sensitive-region context for POST /api/items.
 *
 * Offline queue replay posts the same multipart contract as online submit but
 * never hits POST /analyze-image, so server-side privacy stashes are empty.
 * When stash is missing and an image is present, re-run analyze-image on the
 * uploaded bytes before detection, masking, and persistence.
 */

const { analyzeImage: callAnalyzeImage, mapAiServiceError } = require('../services/aiClient');
const { extractSensitiveRegions } = require('./sensitiveOcrRegions');

/**
 * @param {import('express').Request} req
 * @param {Function} buildImageFormData
 */
function buildAnalyzeFormDataFromRequest(req, buildImageFormData) {
  const documentType = String(req.body?.document_type || req.body?.documentType || 'auto')
    .trim()
    .toLowerCase();

  return buildImageFormData(req.file, {
    category: req.body?.category || '',
    location: req.body?.locationName || req.body?.location || '',
    document_type: documentType,
    title: req.body?.title || '',
    description: req.body?.description || '',
  });
}

/**
 * @param {import('express').Request} req
 * @param {{
 *   stashedAnalyze: object | null,
 *   clientAnalyze: object | null,
 *   stashedRegions: Array<object> | null,
 *   buildImageFormData: Function,
 *   resolveIsSensitiveFromAnalyze: Function,
 * }} options
 * @returns {Promise<{
 *   aiResponse: object | null,
 *   sensitiveRegions: Array<object>,
 *   analyzedOnCreate: boolean,
 *   analyzeSource: 'stash' | 'server_create' | 'client' | 'none',
 * }>}
 */
async function resolveCreateItemAnalyzeContext(req, options) {
  const {
    stashedAnalyze,
    clientAnalyze,
    stashedRegions,
    buildImageFormData,
    resolveIsSensitiveFromAnalyze,
  } = options;

  if (stashedAnalyze && typeof stashedAnalyze === 'object') {
    const sensitiveRegions = stashedRegions?.length
      ? stashedRegions
      : extractSensitiveRegions(stashedAnalyze);
    return {
      aiResponse: stashedAnalyze,
      sensitiveRegions: sensitiveRegions || [],
      analyzedOnCreate: false,
      analyzeSource: 'stash',
    };
  }

  if (req.file) {
    try {
      const formData = buildAnalyzeFormDataFromRequest(req, buildImageFormData);
      const freshAnalyze = await callAnalyzeImage(formData);
      const sensitiveRegions = extractSensitiveRegions(freshAnalyze);
      const sensitivity = resolveIsSensitiveFromAnalyze(freshAnalyze);

      console.info(
        '[item] privacy analyze on create user=%s source=offline_or_deferred regions=%d sensitive=%s',
        req.user?.userId,
        sensitiveRegions.length,
        sensitivity.isSensitive,
      );

      return {
        aiResponse: freshAnalyze,
        sensitiveRegions: sensitiveRegions || [],
        analyzedOnCreate: true,
        analyzeSource: 'server_create',
      };
    } catch (err) {
      const mapped = mapAiServiceError(err);
      console.warn(
        '[item] privacy analyze on create failed user=%s status=%s — falling back to queued analyze payload',
        req.user?.userId,
        mapped.status,
      );
    }
  }

  const aiResponse = clientAnalyze || null;
  let sensitiveRegions = stashedRegions?.length
    ? stashedRegions
    : extractSensitiveRegions(aiResponse);

  let effectiveResponse = aiResponse;
  const clientSensitivity = clientAnalyze ? resolveIsSensitiveFromAnalyze(clientAnalyze) : null;
  const resolvedSensitivity = aiResponse ? resolveIsSensitiveFromAnalyze(aiResponse) : null;

  if (
    clientSensitivity?.isSensitive &&
    (!resolvedSensitivity?.isSensitive || !sensitiveRegions.length)
  ) {
    effectiveResponse = { ...(aiResponse || {}), ...clientAnalyze, is_sensitive: true };
    if (clientSensitivity.sensitiveDocumentType) {
      effectiveResponse.sensitive_document_type = clientSensitivity.sensitiveDocumentType;
      effectiveResponse.sensitiveDocumentType = clientSensitivity.sensitiveDocumentType;
    }
  }

  return {
    aiResponse: effectiveResponse,
    sensitiveRegions: sensitiveRegions || [],
    analyzedOnCreate: false,
    analyzeSource: effectiveResponse ? 'client' : 'none',
  };
}

module.exports = {
  resolveCreateItemAnalyzeContext,
  buildAnalyzeFormDataFromRequest,
};
