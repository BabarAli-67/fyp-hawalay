const mongoose = require('mongoose');
const Match = require('../models/Match');
const Item = require('../models/Item');
const { applyResolvedCategoryToItem } = require('../utils/categoryResolution');
const {
  attachReturnVerificationToMatch,
  confirmReturn,
  getReturnVerification,
} = require('../services/returnVerificationService');

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/** Hard cap for the per-item matches endpoint (no pagination on that route). */
const FOR_ITEM_MATCHES_LIMIT = 100;

/**
 * Only the item fields match cards and return-verification need.
 * Excludes heavy AI payloads (embeddingVector, ocrText, detectedObjects,
 * aiMetadata blobs) that dominate query time and response size.
 */
const MATCH_ITEM_PROJECTION =
  '_id ownerId reportType status title category userCategory aiCategory effectiveCategory ' +
  'locationName location date imageFileId isDeleted aiMetadata.suggestedCategory';

function pickOtherItemForUser(match, sourceItem, matchedItem, userId) {
  const sourceOwnerId = (match.sourceItemOwnerId || sourceItem.ownerId)?.toString();
  const matchedOwnerId = (match.matchedItemOwnerId || matchedItem.ownerId)?.toString();

  if (sourceOwnerId === userId) {
    return matchedItem;
  }
  if (matchedOwnerId === userId) {
    return sourceItem;
  }
  if (sourceItem.ownerId?.toString() === userId) {
    return matchedItem;
  }
  if (matchedItem.ownerId?.toString() === userId) {
    return sourceItem;
  }
  return matchedItem;
}

async function getMatchesForItem(req, res, next) {
  try {
    const { itemId } = req.params;
    const userId = req.user.userId;

    const sourceItem = await Item.findById(itemId).select('ownerId isDeleted').lean();
    if (!sourceItem || sourceItem.isDeleted) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (sourceItem.ownerId.toString() !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const itemIdStr = itemId.toString();

    const matchDocs = await Match.find({
      $or: [{ sourceItemId: itemId }, { matchedItemId: itemId }],
    })
      .sort({ score: -1 })
      .limit(FOR_ITEM_MATCHES_LIMIT)
      .lean();

    const allItemIds = new Set();
    for (const m of matchDocs) {
      allItemIds.add(m.sourceItemId.toString());
      allItemIds.add(m.matchedItemId.toString());
    }

    const items = await Item.find({ _id: { $in: [...allItemIds] } })
      .select(MATCH_ITEM_PROJECTION)
      .lean();
    const itemById = new Map(items.map((i) => [i._id.toString(), i]));

    const matches = matchDocs
      .map((m) => {
        const sourceId = m.sourceItemId.toString();
        const matchedId = m.matchedItemId.toString();
        const otherId = sourceId === itemIdStr ? matchedId : sourceId;
        const sourceItem = itemById.get(sourceId);
        const matchedItem = itemById.get(matchedId);
        const otherItem = itemById.get(otherId);
        if (!otherItem || !sourceItem || !matchedItem) return null;
        const verification = attachReturnVerificationToMatch(m, userId, sourceItem, matchedItem);
        return {
          matchId: m._id,
          score: m.score,
          item: applyResolvedCategoryToItem(otherItem),
          createdAt: m.createdAt,
          returnVerification: verification?.returnVerification ?? null,
        };
      })
      .filter(Boolean);

    return res.status(200).json({ itemId, matches });
  } catch (err) {
    return next(err);
  }
}

async function getUserMatches(req, res, next) {
  try {
    const userId = req.user.userId;
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const { page, limit, skip } = parsePagination(req.query);

    const ownedItems = await Item.find({
      ownerId: userObjectId,
      isDeleted: { $ne: true },
    })
      .select('_id')
      .lean();
    const ownedItemIds = ownedItems.map((item) => item._id);

    const filter = {
      returnCompletedAt: null,
      $or: [
        { sourceItemOwnerId: userObjectId },
        { matchedItemOwnerId: userObjectId },
      ],
    };

    if (ownedItemIds.length > 0) {
      filter.$or.push(
        { sourceItemId: { $in: ownedItemIds } },
        { matchedItemId: { $in: ownedItemIds } },
      );
    }

    const [matchDocs, total] = await Promise.all([
      Match.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Match.countDocuments(filter),
    ]);

    const itemIds = new Set();
    for (const match of matchDocs) {
      itemIds.add(match.sourceItemId.toString());
      itemIds.add(match.matchedItemId.toString());
    }

    const items = await Item.find({
      _id: { $in: [...itemIds] },
      isDeleted: { $ne: true },
    })
      .select(MATCH_ITEM_PROJECTION)
      .lean();
    const itemById = new Map(items.map((item) => [item._id.toString(), item]));

    const matches = matchDocs
      .map((match) => {
        const sourceItem = itemById.get(match.sourceItemId.toString());
        const matchedItem = itemById.get(match.matchedItemId.toString());
        if (!sourceItem || !matchedItem) {
          return null;
        }

        const otherItem = pickOtherItemForUser(match, sourceItem, matchedItem, userId);
        const verification = attachReturnVerificationToMatch(match, userId, sourceItem, matchedItem);
        return {
          matchId: match._id,
          score: match.score,
          item: applyResolvedCategoryToItem(otherItem),
          createdAt: match.createdAt,
          returnVerification: verification?.returnVerification ?? null,
        };
      })
      .filter(Boolean);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      matches,
      total,
      page,
      totalPages,
    });
  } catch (err) {
    return next(err);
  }
}

function mapAccessError(error) {
  if (error === 'invalid_id') {
    return { status: 400, body: { error: 'Invalid match id' } };
  }
  if (error === 'not_found') {
    return { status: 404, body: { error: 'Match not found' } };
  }
  if (error === 'forbidden') {
    return { status: 403, body: { error: 'Forbidden' } };
  }
  if (error === 'invalid_match') {
    return { status: 400, body: { error: 'Match does not link a lost and found report' } };
  }
  return { status: 500, body: { error: 'Could not process return confirmation' } };
}

async function getMatchReturnStatus(req, res, next) {
  try {
    const { matchId } = req.params;
    const userId = req.user.userId;
    const result = await getReturnVerification(matchId, userId);

    if (result.error) {
      const mapped = mapAccessError(result.error);
      return res.status(mapped.status).json(mapped.body);
    }

    return res.status(200).json({
      matchId,
      returnVerification: result.returnVerification,
    });
  } catch (err) {
    return next(err);
  }
}

async function confirmMatchReturn(req, res, next) {
  try {
    const { matchId } = req.params;
    const userId = req.user.userId;
    const result = await confirmReturn(matchId, userId);

    if (result.error) {
      const mapped = mapAccessError(result.error);
      return res.status(mapped.status).json(mapped.body);
    }

    return res.status(200).json({
      matchId,
      returnVerification: result.returnVerification,
      alreadyConfirmed: Boolean(result.alreadyConfirmed),
      alreadyCompleted: Boolean(result.alreadyCompleted),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getMatchesForItem,
  getUserMatches,
  getMatchReturnStatus,
  confirmMatchReturn,
};
