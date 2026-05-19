const crypto = require('crypto');
const bcrypt = require('bcrypt');

const OTP_LENGTH = 6;
const OTP_BCRYPT_ROUNDS = 10;

function getOtpExpiryMinutes() {
  const raw = Number.parseInt(process.env.OTP_EXPIRY_MINUTES, 10);
  if (!Number.isFinite(raw) || raw < 5 || raw > 15) return 10;
  return Math.floor(raw);
}

function getOtpExpiryMs() {
  return getOtpExpiryMinutes() * 60 * 1000;
}

function generateOtp() {
  const max = 10 ** OTP_LENGTH;
  const code = crypto.randomInt(0, max);
  return String(code).padStart(OTP_LENGTH, '0');
}

async function hashOtp(otp) {
  return bcrypt.hash(String(otp), OTP_BCRYPT_ROUNDS);
}

async function verifyOtp(otp, otpHash) {
  return bcrypt.compare(String(otp), otpHash);
}

module.exports = {
  OTP_LENGTH,
  getOtpExpiryMinutes,
  getOtpExpiryMs,
  generateOtp,
  hashOtp,
  verifyOtp,
};
