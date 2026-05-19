const { body } = require('express-validator');

/** At least one lowercase, one uppercase, and one digit (length checked separately). */
const PASSWORD_COMPLEXITY_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

const registrationFieldsValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(PASSWORD_COMPLEXITY_RE)
    .withMessage('Password must include uppercase, lowercase, and a number'),
];

const registerValidation = registrationFieldsValidation;

const sendOtpValidation = registrationFieldsValidation;

const verifyOtpValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email')
    .normalizeEmail(),
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('Verification code is required')
    .matches(/^\d{6}$/)
    .withMessage('Verification code must be 6 digits'),
];

const resendOtpValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email')
    .normalizeEmail(),
];

const passwordResetRequestValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email')
    .normalizeEmail(),
];

const passwordResetVerifyValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email')
    .normalizeEmail(),
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('Reset code is required')
    .matches(/^\d{6}$/)
    .withMessage('Reset code must be 6 digits'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(PASSWORD_COMPLEXITY_RE)
    .withMessage('Password must include uppercase, lowercase, and a number'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Please confirm your password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

module.exports = {
  registerValidation,
  sendOtpValidation,
  verifyOtpValidation,
  resendOtpValidation,
  passwordResetRequestValidation,
  passwordResetVerifyValidation,
  loginValidation,
};
