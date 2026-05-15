const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const errorHandler = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware');
const { generalLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');

const app = express();

const clientUrl = process.env.CLIENT_URL;

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
      if (origin === clientUrl) {
        callback(null, true);
        return;
      }
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

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

module.exports = app;
