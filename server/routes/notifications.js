const express = require('express');

const {
  getUnreadCount,
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllNotificationsAsRead);
router.get('/', listNotifications);
router.patch('/:id/read', markNotificationAsRead);

module.exports = router;
