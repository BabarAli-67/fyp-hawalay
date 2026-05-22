const userService = require('../services/userService');
const { getImageStream } = require('../utils/imageStorage');

function sendServiceError(res, err, next) {
  if (err.status) {
    const body = { error: err.message };
    if (err.code) body.code = err.code;
    return res.status(err.status).json(body);
  }
  return next(err);
}

async function updateProfile(req, res, next) {
  try {
    const { name, email, bio } = req.body;
    const hasField = name !== undefined || email !== undefined || bio !== undefined;
    if (!hasField) {
      return res.status(400).json({ error: 'No profile fields to update' });
    }

    const user = await userService.updateProfile(req.user.userId, { name, email, bio });
    return res.status(200).json({ user });
  } catch (err) {
    return sendServiceError(res, err, next);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    await userService.changePassword(req.user.userId, { currentPassword, newPassword });
    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    return sendServiceError(res, err, next);
  }
}

async function updateAvatar(req, res, next) {
  try {
    if (req.body?.remove === true || req.body?.remove === 'true') {
      const user = await userService.clearAvatar(req.user.userId);
      return res.status(200).json({ user });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const user = await userService.replaceAvatar(
      req.user.userId,
      req.file.buffer,
      req.file.originalname || 'avatar.jpg',
      req.file.mimetype,
    );
    return res.status(200).json({ user });
  } catch (err) {
    return sendServiceError(res, err, next);
  }
}

async function streamAvatar(req, res, next) {
  try {
    const user = await userService.findUserById(req.user.userId);
    if (!user?.avatarFileId) {
      return res.status(404).json({ error: 'No avatar' });
    }

    const downloadStream = getImageStream(user.avatarFileId);

    downloadStream.on('error', (err) => {
      if (err.code === 'ENOENT' || err.name === 'MongoRuntimeError') {
        return res.status(404).json({ error: 'Avatar file not found' });
      }
      return next(err);
    });

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=300');
    downloadStream.pipe(res);
    return undefined;
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  updateProfile,
  changePassword,
  updateAvatar,
  streamAvatar,
};
