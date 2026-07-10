const express = require('express');
const { getCommunityStats } = require('../controllers/statsController');

const router = express.Router();

router.get('/community', getCommunityStats);

module.exports = router;
