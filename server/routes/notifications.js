const express = require('express');

const { getUnreadCount } = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/unread-count', getUnreadCount);

module.exports = router;
