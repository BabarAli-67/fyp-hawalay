function errorHandler(err, req, res, _next) {
  console.error('[express]', err);
  if (err && String(err.message || '').includes('CORS:')) {
    return res.status(403).json({ error: err.message || 'Internal server error' });
  }
  if (err?.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Image must be 5MB or smaller' });
    }
    return res.status(400).json({ error: err.message || 'Invalid upload' });
  }
  if (err?.message === 'Only JPEG and PNG images are allowed') {
    return res.status(400).json({ error: err.message });
  }
  const status = err.statusCode || 500;
  return res.status(status).json({
    error: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
