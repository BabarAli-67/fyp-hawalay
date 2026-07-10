const express = require('express');
const {
  confirmMatchReturn,
  getMatchReturnStatus,
  getMatchesForItem,
  getUserMatches,
} = require('../controllers/matchController');
const handleValidationErrors = require('../middleware/handleValidationErrors');
const { matchIdParamValidation } = require('../middleware/validators/matchValidators');

const router = express.Router();

router.get('/', getUserMatches);
router.get('/for-item/:itemId', getMatchesForItem);
router.get('/:matchId/return-status', matchIdParamValidation, handleValidationErrors, getMatchReturnStatus);
router.post('/:matchId/confirm-return', matchIdParamValidation, handleValidationErrors, confirmMatchReturn);

module.exports = router;
