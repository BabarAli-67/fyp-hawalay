/**
 * Browse / list keyword search — tokenized AND matching across user and AI fields.
 */

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenizeKeyword(keyword) {
  if (typeof keyword !== 'string') return [];
  return keyword.trim().split(/\s+/).filter(Boolean);
}

/**
 * Fields searched for each token. Includes AI-derived data so mismatched titles
 * (e.g. "Necklace" for an iPhone) can still match detection / OCR text.
 */
function tokenMatchClause(token) {
  const regex = new RegExp(escapeRegex(token), 'i');
  return {
    $or: [
      { title: regex },
      { brand: regex },
      { locationName: regex },
      { secondaryLocationName: regex },
      { distinctiveFeatures: regex },
      { category: regex },
      { userCategory: regex },
      { effectiveCategory: regex },
      { colors: regex },
      { caption: regex },
      { ocrText: regex },
      { description: regex },
      { 'detectedObjects.className': regex },
      { 'aiMetadata.ocrDocumentType': regex },
      { 'aiMetadata.suggestedCategory': regex },
    ],
  };
}

function buildKeywordFilter(keyword) {
  const tokens = tokenizeKeyword(keyword);
  if (!tokens.length) return null;
  if (tokens.length === 1) return tokenMatchClause(tokens[0]);
  return { $and: tokens.map((token) => tokenMatchClause(token)) };
}

function buildCategoryFilter(category) {
  return {
    $or: [{ category }, { effectiveCategory: category }, { userCategory: category }],
  };
}

/**
 * Compose MongoDB filter for GET /api/items without clobbering $or clauses.
 *
 * @param {{
 *   category?: string,
 *   reportType?: string,
 *   ownerId?: string,
 *   status?: string,
 *   q?: string,
 * }} params
 */
function buildItemsListFilter({ category, reportType, ownerId, status, q } = {}) {
  const conditions = [{ isDeleted: { $ne: true } }];

  if (category) {
    conditions.push(buildCategoryFilter(category));
  }
  if (reportType) {
    conditions.push({ reportType });
  }
  if (ownerId) {
    conditions.push({ ownerId });
  }
  if (status === 'returned') {
    conditions.push({ status: { $in: ['returned', 'claimed'] } });
  } else if (status) {
    conditions.push({ status });
  }

  const keywordFilter = buildKeywordFilter(q);
  if (keywordFilter) {
    conditions.push(keywordFilter);
  }

  if (conditions.length === 1) {
    return conditions[0];
  }
  return { $and: conditions };
}

module.exports = {
  buildItemsListFilter,
  buildKeywordFilter,
  tokenizeKeyword,
};
