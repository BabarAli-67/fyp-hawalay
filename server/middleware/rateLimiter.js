const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many attempts...' });
  },
});

const ITEM_IMAGE_PATH = /^\/api\/items\/[^/]+\/image$/;
const USER_AVATAR_PATH = /^\/api\/users\/[^/]+\/avatar$/;

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (req.method !== 'GET') return false;
    if (req.path === '/health') return true;
    if (ITEM_IMAGE_PATH.test(req.path)) return true;
    if (USER_AVATAR_PATH.test(req.path)) return true;
    return false;
  },
});

const resendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many resend requests. Please try again later.' });
  },
});

module.exports = {
  authLimiter,
  resendOtpLimiter,
  generalLimiter,
};
