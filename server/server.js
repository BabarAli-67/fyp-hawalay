require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const http = require('http');
const mongoose = require('mongoose');
const { validateEnv } = require('./utils/validateEnv');

const REQUIRED_ENV = [
  'JWT_SECRET',
  'MONGO_URI',
  'PORT',
  'CLIENT_URL',
  'INTERNAL_SECRET',
  'FASTAPI_URL',
  'GOOGLE_CLIENT_ID',
];

validateEnv(REQUIRED_ENV);

require('./services/pushService');
const { initializeObjectModelConfig } = require('./utils/categoryMapping');
initializeObjectModelConfig();

const portNum = Number(process.env.PORT, 10);
if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

require('./config/gridfs');
const app = require('./app');
const { connectDatabase } = require('./config/db');
const { initSocket } = require('./socket');
const { parseAllowedOrigins } = require('./utils/corsOrigins');
const { probeFastApiHealth } = require('./services/aiClient');

async function start() {
  await connectDatabase();

  const port = Number(process.env.PORT, 10);
  const server = http.createServer(app);
  initSocket(server, { corsOrigins: parseAllowedOrigins() });

  server.listen(port, () => {
    console.info(`[server] listening on port ${port}`);
    probeFastApiHealth().catch((err) => {
      console.error('[aiClient] health probe failed:', err.message);
    });
  });

  const shutdown = (signal) => {
    console.info(`[server] ${signal} received, closing…`);
    server.close(async () => {
      try {
        await mongoose.disconnect();
      } catch (e) {
        console.error('[server] mongoose disconnect error:', e.message);
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
