const express = require('express');
const userController = require('../controllers/userController');
const handleValidationErrors = require('../middleware/handleValidationErrors');
const { uploadItemImage } = require('../middleware/uploadItemImage');
const {
  profileValidation,
  changePasswordValidation,
  removeAvatarValidation,
  userIdParamValidation,
} = require('../middleware/validators/userValidators');

const router = express.Router();

function runMiddlewareChain(middlewares, req, res, next) {
  let index = 0;
  function dispatch(err) {
    if (err) return next(err);
    const layer = middlewares[index];
    index += 1;
    if (!layer) return undefined;
    return layer(req, res, dispatch);
  }
  return dispatch();
}

router.get('/me/avatar', userController.streamAvatar);
router.get(
  '/:userId/avatar',
  userIdParamValidation,
  handleValidationErrors,
  userController.streamUserAvatar,
);

router.patch(
  '/profile',
  profileValidation,
  handleValidationErrors,
  userController.updateProfile,
);

router.patch(
  '/password',
  changePasswordValidation,
  handleValidationErrors,
  userController.changePassword,
);

router.patch('/avatar', (req, res, next) => {
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('application/json')) {
    return runMiddlewareChain(
      [...removeAvatarValidation, handleValidationErrors, userController.updateAvatar],
      req,
      res,
      next,
    );
  }

  if (contentType.includes('multipart/form-data')) {
    return uploadItemImage(req, res, (err) => {
      if (err) return next(err);
      return userController.updateAvatar(req, res, next);
    });
  }

  return res.status(415).json({
    error: 'Use multipart/form-data with an image field, or application/json with remove: true',
  });
});

module.exports = router;
