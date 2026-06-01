const express = require('express');
const { listChatRooms, getChatMessages } = require('../controllers/chatController');
const { authMiddleware } = require('../middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/rooms', listChatRooms);
router.get('/:matchId/messages', getChatMessages);

module.exports = router;
