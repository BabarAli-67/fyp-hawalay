const express = require('express');

const itemController = require('../controllers/itemController');
const {
  analyzeImage,
  createItem,
  extractOcr,
  getItemById,
  getItems,
  processImage,
  streamImage,
  updateItem,
  updateStatus,
} = itemController;
const { authMiddleware } = require('../middleware');
const handleValidationErrors = require('../middleware/handleValidationErrors');
const { uploadItemImage } = require('../middleware/uploadItemImage');
const {
  createItemValidation,
  deleteItemValidator,
  getItemsValidation,
  itemIdParamValidation,
  updateItemValidation,
  updateStatusValidation,
} = require('../middleware/validators/itemValidators');

const router = express.Router();

router.use(authMiddleware);

router.post('/ocr', uploadItemImage, extractOcr);
router.post('/process-image', uploadItemImage, processImage);
router.post('/analyze-image', uploadItemImage, analyzeImage);
router.get('/:id/image', itemIdParamValidation, handleValidationErrors, streamImage);
router.patch('/:id/status', updateStatusValidation, handleValidationErrors, updateStatus);
router.patch('/:id', updateItemValidation, handleValidationErrors, updateItem);
router.delete('/:id', authMiddleware, deleteItemValidator, handleValidationErrors, itemController.deleteItem);
router.post('/', uploadItemImage, createItemValidation, handleValidationErrors, createItem);
router.get('/', getItemsValidation, handleValidationErrors, getItems);
router.get('/:id', itemIdParamValidation, handleValidationErrors, getItemById);

module.exports = router;
