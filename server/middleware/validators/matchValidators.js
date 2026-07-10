const { param } = require('express-validator');

const matchIdParamValidation = [param('matchId').isMongoId().withMessage('Invalid match id')];

module.exports = {
  matchIdParamValidation,
};
