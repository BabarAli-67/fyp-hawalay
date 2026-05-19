const express = require('express');

const { getMe, googleAuth, login, register } = require('../controllers/authController');
const {
  requestPasswordReset,
  resendPasswordResetOtp,
  verifyOtpAndResetPassword,
} = require('../controllers/passwordResetController');
const {
  resendOtp,
  sendOtp,
  verifyOtpAndRegister,
} = require('../controllers/registrationController');
const { authMiddleware } = require('../middleware');
const handleValidationErrors = require('../middleware/handleValidationErrors');
const { authLimiter, resendOtpLimiter } = require('../middleware/rateLimiter');
const {
  loginValidation,
  passwordResetRequestValidation,
  passwordResetVerifyValidation,
  registerValidation,
  resendOtpValidation,
  sendOtpValidation,
  verifyOtpValidation,
} = require('../middleware/validators/authValidators');

const router = express.Router();

router.post('/register', authLimiter, registerValidation, handleValidationErrors, register);
router.post(
  '/register/send-otp',
  authLimiter,
  sendOtpValidation,
  handleValidationErrors,
  sendOtp,
);
router.post(
  '/register/verify-otp',
  authLimiter,
  verifyOtpValidation,
  handleValidationErrors,
  verifyOtpAndRegister,
);
router.post(
  '/register/resend-otp',
  resendOtpLimiter,
  resendOtpValidation,
  handleValidationErrors,
  resendOtp,
);
router.post(
  '/password-reset/request',
  authLimiter,
  passwordResetRequestValidation,
  handleValidationErrors,
  requestPasswordReset,
);
router.post(
  '/password-reset/resend-otp',
  resendOtpLimiter,
  passwordResetRequestValidation,
  handleValidationErrors,
  resendPasswordResetOtp,
);
router.post(
  '/password-reset/verify',
  authLimiter,
  passwordResetVerifyValidation,
  handleValidationErrors,
  verifyOtpAndResetPassword,
);
router.post('/login', authLimiter, loginValidation, handleValidationErrors, login);
router.post('/google', authLimiter, googleAuth);
router.get('/me', authMiddleware, getMe);

module.exports = router;
