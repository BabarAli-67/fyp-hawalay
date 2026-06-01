const express = require('express');
const { getMatchesForItem } = require('../controllers/matchController');

const router = express.Router();

router.get('/for-item/:itemId', getMatchesForItem);

module.exports = router;
