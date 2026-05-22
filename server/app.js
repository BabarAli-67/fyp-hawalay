const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const errorHandler = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware');
const { generalLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const notificationRoutes = require('./routes/notifications');
const userRoutes = require('./routes/users');
const { parseAllowedOrigins, isOriginAllowed } = require('./utils/corsOrigins');

const app = express();

const allowedOrigins = parseAllowedOrigins();
if (allowedOrigins.length === 0) {
  console.warn('[cors] No CLIENT_URL set — browser requests from a web app may be blocked.');
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }
      console.warn(`[cors] Blocked origin: ${origin} (allowed: ${allowedOrigins.join(', ') || 'none'})`);
      callback(new Error(`CORS: forbidden origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  }),
);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(generalLimiter);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'hawalay-api' });
});

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  const path = req.originalUrl.split('?')[0];
  if (path.startsWith('/api/auth')) {
    return next();
  }
  return authMiddleware(req, res, next);
});

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

module.exports = app;
