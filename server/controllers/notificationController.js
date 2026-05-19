const Notification = require('../models/Notification');

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

module.exports = {
  getUnreadCount,
};
