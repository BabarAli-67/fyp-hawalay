const { body } = require('express-validator');
const { PASSWORD_COMPLEXITY_RE } = require('./authValidators');

const profileValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 120 })
    .withMessage('Name is too long'),
  body('email')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email')
    .normalizeEmail(),
  body('bio')
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must be 500 characters or less'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(PASSWORD_COMPLEXITY_RE)
    .withMessage('Password must include uppercase, lowercase, and a number'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Please confirm your password')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];

const removeAvatarValidation = [
  body('remove').custom((value) => {
    if (value === true || value === 'true') return true;
    throw new Error('Set remove to true to delete your avatar');
  }),
];

module.exports = {
  profileValidation,
  changePasswordValidation,
  removeAvatarValidation,
};
