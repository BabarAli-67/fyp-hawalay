const webpush = require('web-push');

const hasVapidConfig = Boolean(
  process.env.VAPID_PUBLIC_KEY?.trim()
  && process.env.VAPID_PRIVATE_KEY?.trim()
  && process.env.VAPID_EMAIL?.trim(),
);

webpush.isConfigured = hasVapidConfig;

if (hasVapidConfig) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
} else {
  console.warn('[server] Web push disabled — VAPID keys not configured');
}

/**
 * Send a web push to a user when VAPID and subscription are available.
 * No-op (debug log) when push is not configured or user has no subscription.
 */
async function sendPushToUser(user, payload) {
  if (!webpush.isConfigured || !user?.pushSubscription) {
    console.debug('[push] push skipped — not configured');
    return;
  }

  try {
    await webpush.sendNotification(
      user.pushSubscription,
      JSON.stringify(payload),
    );
  } catch (err) {
    console.error('[push] send failed:', err.message);
  }
}

module.exports = {
  webpush,
  sendPushToUser,
};
