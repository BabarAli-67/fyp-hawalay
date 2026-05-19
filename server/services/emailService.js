const nodemailer = require('nodemailer');
const { getOtpExpiryMinutes } = require('./otpService');

let transport;

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_PORT?.trim() &&
      process.env.SMTP_FROM?.trim(),
  );
}

function getTransport() {
  if (transport) return transport;

  if (!isSmtpConfigured()) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT, 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  return transport;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function deliverEmail({ to, subject, text, html, devLabel }) {
  const mailer = getTransport();
  const devLog = process.env.EMAIL_VERIFICATION_DEV_LOG === 'true';

  if (!mailer) {
    if (devLog) {
      console.info(`[email:dev] ${devLabel} → ${to}\n${text}`);
      return;
    }
    throw new Error(
      'SMTP is not configured. Set SMTP_* variables or EMAIL_VERIFICATION_DEV_LOG=true for local development.',
    );
  }

  await mailer.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}

function buildOtpEmailHtml({ title, intro, otp, minutes, footerNote }) {
  return `
    <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; font-size: 20px; font-weight: 700; color: #2d5a4a;">Hawalay</div>
        <p style="margin: 4px 0 0; font-size: 13px; color: #666;">AI-Powered Recovery</p>
      </div>
      <div style="background: #f8faf9; border: 1px solid #e2e8e4; border-radius: 12px; padding: 24px;">
        <h1 style="margin: 0 0 12px; font-size: 20px;">${escapeHtml(title)}</h1>
        <p style="margin: 0 0 20px; line-height: 1.5; color: #444;">${escapeHtml(intro)}</p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Your code</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; margin: 0 0 20px; color: #2d5a4a;">${escapeHtml(otp)}</p>
        <p style="margin: 0; font-size: 14px; color: #555;">Expires in <strong>${minutes} minutes</strong>.</p>
      </div>
      <p style="margin: 20px 0 0; font-size: 13px; color: #888; line-height: 1.5;">${escapeHtml(footerNote)}</p>
      <p style="margin: 16px 0 0; font-size: 12px; color: #aaa;">© ${new Date().getFullYear()} Hawalay</p>
    </div>
  `;
}

/**
 * @param {{ to: string, name: string, otp: string }} params
 */
async function sendVerificationOtpEmail({ to, name, otp }) {
  const minutes = getOtpExpiryMinutes();
  const subject = 'Your Hawalay verification code';
  const text = [
    `Hi ${name},`,
    '',
    `Your email verification code is: ${otp}`,
    '',
    `This code expires in ${minutes} minutes.`,
    'If you did not request this, you can ignore this email.',
    '',
    '— Hawalay',
  ].join('\n');

  const html = buildOtpEmailHtml({
    title: 'Verify your email',
    intro: `Hi ${name}, use this code to verify your email and complete your Hawalay registration.`,
    otp,
    minutes,
    footerNote: 'If you did not create an account, you can safely ignore this email.',
  });

  await deliverEmail({ to, subject, text, html, devLabel: `Registration OTP ${otp}` });
}

/**
 * @param {{ to: string, name: string, otp: string }} params
 */
async function sendPasswordResetOtpEmail({ to, name, otp }) {
  const minutes = getOtpExpiryMinutes();
  const subject = 'Reset your Hawalay password';
  const text = [
    `Hi ${name},`,
    '',
    `Your password reset code is: ${otp}`,
    '',
    `This code expires in ${minutes} minutes.`,
    'If you did not request a password reset, ignore this email. Your password will not change.',
    '',
    '— Hawalay',
  ].join('\n');

  const html = buildOtpEmailHtml({
    title: 'Reset your password',
    intro: `Hi ${name}, we received a request to reset your Hawalay password. Enter this code on the reset password page.`,
    otp,
    minutes,
    footerNote:
      'If you did not request a password reset, ignore this email. Your password will remain unchanged.',
  });

  await deliverEmail({ to, subject, text, html, devLabel: `Password reset OTP ${otp}` });
}

module.exports = {
  isSmtpConfigured,
  sendVerificationOtpEmail,
  sendPasswordResetOtpEmail,
};

