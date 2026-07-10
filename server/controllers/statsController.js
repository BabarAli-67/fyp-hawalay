const Item = require('../models/Item');
const User = require('../models/User');

/**
 * Global platform statistics for the dashboard Community Impact card.
 * One Item aggregation + one User count (parallel).
 */
async function getCommunityStats(req, res, next) {
  try {
    const [itemRows, activeHelpers] = await Promise.all([
      Item.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            itemsLost: {
              $sum: { $cond: [{ $eq: ['$reportType', 'lost'] }, 1, 0] },
            },
            itemsFound: {
              $sum: { $cond: [{ $eq: ['$reportType', 'found'] }, 1, 0] },
            },
            itemsReunited: {
              $sum: {
                $cond: [{ $in: ['$status', ['returned', 'claimed']] }, 1, 0],
              },
            },
          },
        },
      ]),
      User.countDocuments({ isActive: { $ne: false } }),
    ]);

    const row = itemRows[0] || {};

    return res.status(200).json({
      itemsLost: row.itemsLost ?? 0,
      itemsFound: row.itemsFound ?? 0,
      itemsReunited: row.itemsReunited ?? 0,
      activeHelpers,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getCommunityStats,
};
