const { body, param, query } = require('express-validator');

const CATEGORIES = ['Electronics', 'Clothing', 'Documents', 'Accessories', 'Other'];
const REPORT_TYPES = ['lost', 'found'];
const STATUSES = ['active', 'claimed', 'expired', 'returned'];
const CONTACT_PREFERENCES = ['in_app_chat', 'show_email'];

const createItemValidation = [
  body('reportType').isIn(REPORT_TYPES).withMessage('reportType must be lost or found'),
  body('title').trim().notEmpty().withMessage('title is required').isLength({ max: 100 }),
  body('category').isIn(CATEGORIES).withMessage('Invalid category'),
  body('userCategory').optional().isIn(CATEGORIES).withMessage('Invalid userCategory'),
  body('locationName').trim().notEmpty().withMessage('locationName is required'),
  body('date').isISO8601().withMessage('date must be a valid ISO date'),
  body('description').optional().isLength({ max: 1000 }),
  body('caption').optional().trim(),
  body('ocrText').optional().trim(),
  body('imageFileId').optional().isMongoId().withMessage('Invalid imageFileId'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('embeddingVector').optional(),
  body('location').optional(),
  body('secondaryLocation').optional(),
  body('brand').optional().trim().isLength({ max: 100 }),
  body('colors').optional(),
  body('distinctiveFeatures').optional().isLength({ max: 500 }),
  body('contactPreference').optional().isIn(CONTACT_PREFERENCES),
  body('secondaryLocationName').optional().trim().isLength({ max: 200 }),
  body('analyzeResult')
    .optional()
    .custom((value) => {
      if (value == null || value === '') return true;
      if (typeof value === 'object') return true;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return parsed !== null && typeof parsed === 'object';
        } catch {
          return false;
        }
      }
      return false;
    })
    .withMessage('analyzeResult must be valid JSON'),
];

const getItemsValidation = [
  query('category').optional().isIn(CATEGORIES),
  query('reportType').optional().isIn(REPORT_TYPES),
  query('status').optional().isIn(STATUSES),
  query('ownerId').optional().isMongoId(),
  query('q').optional().trim().isLength({ max: 120 }),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const itemIdParamValidation = [param('id').isMongoId().withMessage('Invalid item id')];

const updateStatusValidation = [
  ...itemIdParamValidation,
  body('status').isIn(STATUSES).withMessage('Invalid status'),
  body('claimedByUserId').optional().isMongoId().withMessage('Invalid claimedByUserId'),
];

const deleteItemValidator = [param('id').isMongoId()];

module.exports = {
  createItemValidation,
  getItemsValidation,
  itemIdParamValidation,
  updateStatusValidation,
  deleteItemValidator,
};
