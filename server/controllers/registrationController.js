const bcrypt = require('bcrypt');
const EmailVerification = require('../models/EmailVerification');
const User = require('../models/User');
const { sendVerificationOtpEmail } = require('../services/emailService');
const {
  generateOtp,
  getOtpExpiryMinutes,
  getOtpExpiryMs,
  hashOtp,
  verifyOtp,
} = require('../services/otpService');
const { signAccessToken } = require('../utils/authTokens');

const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_RESENDS = 5;

async function sendOtp(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const now = new Date();
    const otpExpiresAt = new Date(now.getTime() + getOtpExpiryMs());

    await EmailVerification.findOneAndUpdate(
      { email: normalizedEmail },
      {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        otpHash,
        otpExpiresAt,
        verifyAttempts: 0,
        lastOtpSentAt: now,
        resendCount: 0,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await sendVerificationOtpEmail({ to: normalizedEmail, name: name.trim(), otp });

    return res.status(200).json({
      message: 'Verification code sent to your email.',
      email: normalizedEmail,
      expiresInMinutes: getOtpExpiryMinutes(),
    });
  } catch (err) {
    if (err.message?.includes('SMTP')) {
      return res.status(503).json({ error: 'Email service is temporarily unavailable. Please try again later.' });
    }
    return next(err);
  }
}

async function verifyOtpAndRegister(req, res, next) {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const pending = await EmailVerification.findOne({ email: normalizedEmail });
    if (!pending) {
      return res.status(400).json({
        error: 'No pending verification for this email. Please start registration again.',
        code: 'VERIFICATION_NOT_FOUND',
      });
    }

    if (pending.otpExpiresAt.getTime() < Date.now()) {
      await EmailVerification.deleteOne({ _id: pending._id });
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new code.',
        code: 'OTP_EXPIRED',
      });
    }

    if (pending.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
      await EmailVerification.deleteOne({ _id: pending._id });
      return res.status(429).json({
        error: 'Too many failed attempts. Please request a new verification code.',
        code: 'OTP_ATTEMPTS_EXCEEDED',
      });
    }

    const otpValid = await verifyOtp(otp, pending.otpHash);
    if (!otpValid) {
      pending.verifyAttempts += 1;
      await pending.save();
      const remaining = MAX_VERIFY_ATTEMPTS - pending.verifyAttempts;
      return res.status(400).json({
        error:
          remaining > 0
            ? `Invalid verification code. ${remaining} attempt(s) remaining.`
            : 'Invalid verification code.',
        code: 'OTP_INVALID',
        attemptsRemaining: Math.max(0, remaining),
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      await EmailVerification.deleteOne({ _id: pending._id });
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create({
      name: pending.name,
      email: normalizedEmail,
      passwordHash: pending.passwordHash,
      authProvider: 'local',
      isVerified: true,
    });

    await EmailVerification.deleteOne({ _id: pending._id });

    const token = signAccessToken(user);
    return res.status(201).json({
      message: 'Email verified. Account created successfully.',
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    return next(err);
  }
}

async function resendOtp(req, res, next) {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      return res.status(403).json({
        error: 'Account exists but email is not verified. Contact support or register again.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const pending = await EmailVerification.findOne({ email: normalizedEmail });
    if (!pending) {
      return res.status(400).json({
        error: 'No pending verification for this email. Please complete the registration form first.',
        code: 'VERIFICATION_NOT_FOUND',
      });
    }

    const sinceLastSend = Date.now() - pending.lastOtpSentAt.getTime();
    if (sinceLastSend < RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - sinceLastSend) / 1000);
      return res.status(429).json({
        error: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
        code: 'RESEND_COOLDOWN',
        retryAfterSeconds,
      });
    }

    if (pending.resendCount >= MAX_RESENDS) {
      await EmailVerification.deleteOne({ _id: pending._id });
      return res.status(429).json({
        error: 'Maximum resend limit reached. Please start registration again.',
        code: 'RESEND_LIMIT',
      });
    }

    const otp = generateOtp();
    const now = new Date();
    pending.otpHash = await hashOtp(otp);
    pending.otpExpiresAt = new Date(now.getTime() + getOtpExpiryMs());
    pending.verifyAttempts = 0;
    pending.lastOtpSentAt = now;
    pending.resendCount += 1;
    await pending.save();

    await sendVerificationOtpEmail({ to: normalizedEmail, name: pending.name, otp });

    return res.status(200).json({
      message: 'A new verification code has been sent to your email.',
      email: normalizedEmail,
      expiresInMinutes: getOtpExpiryMinutes(),
      retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    });
  } catch (err) {
    if (err.message?.includes('SMTP')) {
      return res.status(503).json({ error: 'Email service is temporarily unavailable. Please try again later.' });
    }
    return next(err);
  }
}

module.exports = {
  sendOtp,
  verifyOtpAndRegister,
  resendOtp,
};
