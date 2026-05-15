const { validationResult } = require('express-validator');

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array().map((e) => ({
        field: e.path ?? e.param,
        message: e.msg,
      })),
    });
  }
  return next();
}

module.exports = handleValidationErrors;
