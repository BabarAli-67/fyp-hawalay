const Match = require('../models/Match');
const Item = require('../models/Item');

async function getMatchesForItem(req, res, next) {
  try {
    const { itemId } = req.params;
    const userId = req.user.userId;

    const sourceItem = await Item.findById(itemId).lean();
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
      .lean();

    const otherItemIds = matchDocs.map((m) => {
      const sourceId = m.sourceItemId.toString();
      const matchedId = m.matchedItemId.toString();
      return sourceId === itemIdStr ? matchedId : sourceId;
    });

    const items = await Item.find({ _id: { $in: otherItemIds } }).lean();
    const itemById = new Map(items.map((i) => [i._id.toString(), i]));

    const matches = matchDocs
      .map((m) => {
        const sourceId = m.sourceItemId.toString();
        const otherId = sourceId === itemIdStr ? m.matchedItemId.toString() : sourceId;
        const otherItem = itemById.get(otherId);
        if (!otherItem) return null;
        return {
          matchId: m._id,
          score: m.score,
          item: otherItem,
          createdAt: m.createdAt,
        };
      })
      .filter(Boolean);

    return res.status(200).json({ itemId, matches });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getMatchesForItem,
};
