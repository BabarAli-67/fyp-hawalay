/**
 * Async matching flow (after POST /api/items returns 201):
 *   Express → POST /ai/match (FastAPI) → MongoDB candidates → matches back
 *   → persist Match + Notification → Socket.io push
 */
const Match = require('../models/Match');
const { postJson } = require('./aiClient');
const { isValidEmbeddingVector } = require('../utils/itemEmbedding');
const Notification = require('../models/Notification');
const Item = require('../models/Item');
const User = require('../models/User');
const { sendPushToUser } = require('./pushService');
const { emitToUser } = require('../socket');

const MATCH_LIMIT = 5;
const MATCH_TIMEOUT_MS = 60_000;

async function persistMatchAndNotify(sourceItem, matchPayload) {
  const matchedItemId = matchPayload.item_id;
  const score = matchPayload.score;

  const existing = await Match.findOne({
    sourceItemId: sourceItem._id,
    matchedItemId,
  });
  if (existing) {
    return existing;
  }

  const matchedItem = await Item.findById(matchedItemId).lean();
  if (!matchedItem) {
    return null;
  }

  const matchDoc = await Match.create({
    sourceItemId: sourceItem._id,
    matchedItemId,
    sourceItemOwnerId: sourceItem.ownerId,
    matchedItemOwnerId: matchedItem.ownerId,
    score,
    notifiedAt: new Date(),
  });

  const sourceOwnerId = sourceItem.ownerId.toString();
  const matchedOwnerId = matchedItem.ownerId?.toString();

  const notifications = [];

  const sourceMessage = `Possible match found for "${sourceItem.title}" — "${matchedItem.title}" (${Math.round(score * 100)}% similar)`;
  let reverseMessage = null;

  notifications.push(
    Notification.create({
      userId: sourceItem.ownerId,
      type: 'match_found',
      title: 'New match found',
      message: sourceMessage,
      itemId: sourceItem._id,
      matchedItemId,
      matchId: matchDoc._id,
    }),
  );

  if (matchedOwnerId && matchedOwnerId !== sourceOwnerId) {
    reverseMessage = `Someone reported a ${sourceItem.reportType === 'lost' ? 'found' : 'lost'} item that may match yours — "${sourceItem.title}" (${Math.round(score * 100)}% similar)`;
    notifications.push(
      Notification.create({
        userId: matchedItem.ownerId,
        type: 'match_found',
        title: 'New match found',
        message: reverseMessage,
        itemId: matchedItemId,
        matchedItemId: sourceItem._id,
        matchId: matchDoc._id,
      }),
    );
  }

  await Promise.all(notifications);

  const pushPayload = {
    title: 'New match found',
    body: sourceMessage,
    tag: matchDoc._id.toString(),
  };

  const sourceUser = await User.findById(sourceItem.ownerId).select('pushSubscription').lean();
  await sendPushToUser(sourceUser, pushPayload);

  if (matchedOwnerId && matchedOwnerId !== sourceOwnerId && reverseMessage) {
    const matchedUser = await User.findById(matchedItem.ownerId).select('pushSubscription').lean();
    await sendPushToUser(matchedUser, {
      ...pushPayload,
      body: reverseMessage,
    });
  }

  emitToUser(sourceOwnerId, 'match:found', {
    matchId: matchDoc._id.toString(),
    sourceItemId: sourceItem._id.toString(),
    matchedItemId,
    score,
    title: matchedItem.title,
  });

  if (matchedOwnerId && matchedOwnerId !== sourceOwnerId) {
    emitToUser(matchedOwnerId, 'match:found', {
      matchId: matchDoc._id.toString(),
      sourceItemId: sourceItem._id.toString(),
      matchedItemId,
      score,
      title: sourceItem.title,
    });
  }

  return matchDoc;
}

function itemHasEmbedding(item) {
  const vec = item.embeddingVector;
  if (!isValidEmbeddingVector(vec)) {
    return false;
  }
  if (item.embeddingAvailable === false) {
    return false;
  }
  if (item.aiMetadata?.embeddingAvailable === false) {
    return false;
  }
  return true;
}

async function triggerMatching(item) {
  const itemId = item._id.toString();

  if (!itemHasEmbedding(item)) {
    console.warn(`[matching] Skipping matching for item ${itemId} — no embedding available`);
    return;
  }

  if (!process.env.FASTAPI_URL?.trim()) {
    console.warn('[matching] FASTAPI_URL not set — skipping match for', itemId);
    return;
  }

  console.info('[matching] background job started for item', itemId);

  try {
    const data = await postJson(
      '/ai/match',
      { item_id: itemId, limit: MATCH_LIMIT },
      { timeout: MATCH_TIMEOUT_MS },
    );

    const status = data?.status;
    if (status === 'no_embedding') {
      console.info('[matching] no embedding on item — skipping', itemId);
      return;
    }

    if (status !== 'success') {
      console.info('[matching] FastAPI status=%s item=%s matches=0', status, itemId);
      return;
    }

    const matches = Array.isArray(data.matches) ? data.matches : [];
    console.info('[matching] item=%s found %d match(es)', itemId, matches.length);

    for (const matchPayload of matches) {
      await persistMatchAndNotify(item, matchPayload);
    }
  } catch (err) {
    const detail = err.response?.data?.detail || err.message;
    console.error('[matching] failed for item', itemId, detail);
    throw err;
  }
}

async function triggerMatchingWithRetry(item, attempt = 1) {
  try {
    await triggerMatching(item);
  } catch (err) {
    if (attempt < 2) {
      console.warn(
        `[matching] Match job failed for item ${item._id}, attempt ${attempt}. Retrying in 5s...`,
      );
      setTimeout(() => {
        triggerMatchingWithRetry(item, attempt + 1).catch((retryErr) => {
          console.error('[matching] unexpected error on retry', retryErr);
        });
      }, 5000);
    } else {
      console.error(
        `[matching] Match job permanently failed for item ${item._id} after 2 attempts. Item will not be matched automatically.`,
        { itemId: item._id, error: err.message },
      );
    }
  }
}

module.exports = {
  triggerMatching,
  triggerMatchingWithRetry,
};
