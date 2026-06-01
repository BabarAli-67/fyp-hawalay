const mongoose = require('mongoose');
const Match = require('../models/Match');
const Item = require('../models/Item');

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

/**
 * Load match and verify user is a participant (owner on either side).
 * Supports legacy Match docs without ownerId fields via Item lookup.
 */
async function findMatchForParticipant(matchId, userId) {
  if (!isValidObjectId(matchId)) {
    return { error: 'invalid_id' };
  }

  const match = await Match.findById(matchId).lean();
  if (!match) {
    return { error: 'not_found' };
  }

  const uid = userId.toString();

  if (match.sourceItemOwnerId && match.matchedItemOwnerId) {
    const sourceOwner = match.sourceItemOwnerId.toString();
    const matchedOwner = match.matchedItemOwnerId.toString();
    if (uid === sourceOwner || uid === matchedOwner) {
      return { match, sourceOwner, matchedOwner };
    }
    return { error: 'forbidden' };
  }

  const [sourceItem, matchedItem] = await Promise.all([
    Item.findById(match.sourceItemId).select('ownerId title').lean(),
    Item.findById(match.matchedItemId).select('ownerId title').lean(),
  ]);

  if (!sourceItem || !matchedItem) {
    return { error: 'not_found' };
  }

  const sourceOwner = sourceItem.ownerId.toString();
  const matchedOwner = matchedItem.ownerId.toString();

  if (uid !== sourceOwner && uid !== matchedOwner) {
    return { error: 'forbidden' };
  }

  return {
    match,
    sourceOwner,
    matchedOwner,
    sourceItem,
    matchedItem,
  };
}

/**
 * Socket-friendly access check (same rules as REST chat).
 */
async function verifyMatchParticipant(matchId, userId) {
  const access = await findMatchForParticipant(matchId, userId);
  if (access.error === 'invalid_id') {
    return { ok: false, code: 'INVALID_MATCH' };
  }
  if (access.error === 'not_found') {
    return { ok: false, code: 'NOT_FOUND' };
  }
  if (access.error === 'forbidden') {
    return { ok: false, code: 'UNAUTHORIZED' };
  }
  return { ok: true, ...access };
}

module.exports = {
  findMatchForParticipant,
  verifyMatchParticipant,
};
