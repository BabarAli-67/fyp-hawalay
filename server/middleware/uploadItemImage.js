const multer = require('multer');

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only JPEG and PNG images are allowed'));
  },
});

function uploadItemImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err) return next(err);
    return next();
  });
}

module.exports = { uploadItemImage, MAX_BYTES };
