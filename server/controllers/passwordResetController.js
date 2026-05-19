const bcrypt = require('bcrypt');
const PasswordReset = require('../models/PasswordReset');
const User = require('../models/User');
const { sendPasswordResetOtpEmail } = require('../services/emailService');
const {
  generateOtp,
  getOtpExpiryMinutes,
  getOtpExpiryMs,
  hashOtp,
  verifyOtp,
} = require('../services/otpService');

const PASSWORD_RESET_SENT_MESSAGE =
  'We have sent an OTP/password reset code to your email.';
const EMAIL_NOT_REGISTERED_MESSAGE = 'No account is registered with this email address.';
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_RESENDS = 5;

async function findEligibleLocalUser(email) {
  const user = await User.findOne({ email });
  if (!user) return null;
  if (user.authProvider !== 'local' || !user.passwordHash) return null;
  if (!user.isVerified) return null;
  return user;
}

async function issuePasswordResetOtp(user) {
  const normalizedEmail = user.email;
  const otp = generateOtp();
  const now = new Date();

  await PasswordReset.findOneAndUpdate(
    { email: normalizedEmail },
    {
      email: normalizedEmail,
      otpHash: await hashOtp(otp),
      otpExpiresAt: new Date(now.getTime() + getOtpExpiryMs()),
      verifyAttempts: 0,
      lastOtpSentAt: now,
      resendCount: 0,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await sendPasswordResetOtpEmail({
    to: normalizedEmail,
    name: user.name,
    otp,
  });
}

async function requestPasswordReset(req, res, next) {
  try {
    const normalizedEmail = req.body.email.toLowerCase().trim();
    const account = await User.findOne({ email: normalizedEmail });

    if (!account) {
      return res.status(404).json({
        error: EMAIL_NOT_REGISTERED_MESSAGE,
        code: 'EMAIL_NOT_FOUND',
      });
    }

    const user = await findEligibleLocalUser(normalizedEmail);
    if (!user) {
      return res.status(404).json({
        error: EMAIL_NOT_REGISTERED_MESSAGE,
        code: 'EMAIL_NOT_FOUND',
      });
    }

    await issuePasswordResetOtp(user);

    return res.status(200).json({
      message: PASSWORD_RESET_SENT_MESSAGE,
      expiresInMinutes: getOtpExpiryMinutes(),
    });
  } catch (err) {
    if (err.message?.includes('SMTP')) {
      return res.status(503).json({ error: 'Email service is temporarily unavailable. Please try again later.' });
    }
    return next(err);
  }
}

async function resendPasswordResetOtp(req, res, next) {
  try {
    const normalizedEmail = req.body.email.toLowerCase().trim();
    const user = await findEligibleLocalUser(normalizedEmail);

    if (!user) {
      return res.status(200).json({
        message: PASSWORD_RESET_SENT_MESSAGE,
        expiresInMinutes: getOtpExpiryMinutes(),
        retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
      });
    }

    const pending = await PasswordReset.findOne({ email: normalizedEmail });
    if (!pending) {
      await issuePasswordResetOtp(user);
      return res.status(200).json({
        message: PASSWORD_RESET_SENT_MESSAGE,
        expiresInMinutes: getOtpExpiryMinutes(),
        retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
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
      await PasswordReset.deleteOne({ _id: pending._id });
      return res.status(429).json({
        error: 'Maximum resend limit reached. Please request a new password reset.',
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

    await sendPasswordResetOtpEmail({ to: normalizedEmail, name: user.name, otp });

    return res.status(200).json({
      message: 'A new password reset code has been sent.',
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

async function verifyOtpAndResetPassword(req, res, next) {
  try {
    const { email, otp, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await findEligibleLocalUser(normalizedEmail);
    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired reset code.',
        code: 'RESET_INVALID',
      });
    }

    const pending = await PasswordReset.findOne({ email: normalizedEmail });
    if (!pending) {
      return res.status(400).json({
        error: 'Invalid or expired reset code.',
        code: 'RESET_INVALID',
      });
    }

    if (pending.otpExpiresAt.getTime() < Date.now()) {
      await PasswordReset.deleteOne({ _id: pending._id });
      return res.status(400).json({
        error: 'Reset code has expired. Please request a new code.',
        code: 'OTP_EXPIRED',
      });
    }

    if (pending.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
      await PasswordReset.deleteOne({ _id: pending._id });
      return res.status(429).json({
        error: 'Too many failed attempts. Please request a new reset code.',
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
            ? `Invalid reset code. ${remaining} attempt(s) remaining.`
            : 'Invalid reset code.',
        code: 'OTP_INVALID',
        attemptsRemaining: Math.max(0, remaining),
      });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();
    await PasswordReset.deleteOne({ _id: pending._id });

    return res.status(200).json({
      message: 'Password updated successfully. You can now sign in with your new password.',
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  requestPasswordReset,
  resendPasswordResetOtp,
  verifyOtpAndResetPassword,
};
