const mongoose = require('mongoose');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

let listenersAttached = false;

function attachConnectionLogging() {
  if (listenersAttached) {
    return;
  }
  listenersAttached = true;
  mongoose.connection.on('connected', () => {
    console.info('[mongodb] connected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[mongodb] connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[mongodb] disconnected');
  });
}

/**
 * Connect to MongoDB with limited retries (transient network / Atlas cold start).
 * @returns {Promise<void>}
 */
async function connectDatabase() {
  attachConnectionLogging();

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set');
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000,
      });
      return;
    } catch (err) {
      lastError = err;
      console.error(
        `[mongodb] connect attempt ${attempt}/${MAX_RETRIES} failed:`,
        err.message,
      );
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
  throw lastError;
}

module.exports = { connectDatabase };
