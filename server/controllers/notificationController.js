const mongoose = require('mongoose');
const Notification = require('../models/Notification');

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function formatNotification(doc) {
  const populatedItem =
    doc.itemId && typeof doc.itemId === 'object' && doc.itemId._id ? doc.itemId : null;

  return {
    _id: doc._id,
    type: doc.type,
    message: doc.message,
    relatedItemId: populatedItem?._id ?? (doc.itemId || null),
    relatedMatchId: doc.matchId ?? null,
    isRead: Boolean(doc.read),
    createdAt: doc.createdAt,
    item: populatedItem
      ? {
          title: populatedItem.title,
          imageFileId: populatedItem.imageFileId ?? null,
        }
      : null,
  };
}

async function getUnreadCount(req, res, next) {
  try {
    const count = await Notification.countDocuments({
      userId: req.user.userId,
      read: false,
    });
    return res.status(200).json({ count });
  } catch (err) {
    return next(err);
  }
}

async function listNotifications(req, res, next) {
  try {
    const userId = req.user.userId;
    const { page, limit, skip } = parsePagination(req.query);

    const filter = { userId };

    const [rows, total, unread] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('itemId', 'title imageFileId')
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read: false }),
    ]);

    const pages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      notifications: rows.map(formatNotification),
      total,
      unread,
      page,
      pages,
    });
  } catch (err) {
    return next(err);
  }
}

async function markNotificationAsRead(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid notification id' });
    }

    const updated = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      { read: true },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return next(err);
  }
}

async function markAllNotificationsAsRead(req, res, next) {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.userId, read: false },
      { read: true },
    );

    return res.status(200).json({ updated: result.modifiedCount });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getUnreadCount,
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
