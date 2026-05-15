const express = require('express');

const { getMe, googleAuth, login, register } = require('../controllers/authController');
const { authMiddleware } = require('../middleware');
const handleValidationErrors = require('../middleware/handleValidationErrors');
const { authLimiter } = require('../middleware/rateLimiter');
const { loginValidation, registerValidation } = require('../middleware/validators/authValidators');

const router = express.Router();

router.post('/register', authLimiter, registerValidation, handleValidationErrors, register);
router.post('/login', authLimiter, loginValidation, handleValidationErrors, login);
router.post('/google', authLimiter, googleAuth);
router.get('/me', authMiddleware, getMe);

module.exports = router;
