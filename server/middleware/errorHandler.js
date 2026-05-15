function errorHandler(err, req, res, _next) {
  console.error('[express]', err);
  if (err && String(err.message || '').includes('CORS:')) {
    return res.status(403).json({ error: err.message || 'Internal server error' });
  }
  const status = err.statusCode || 500;
  return res.status(status).json({
    error: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
