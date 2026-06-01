const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('../models/User');
const Match = require('../models/Match');
const { uploadToGridFS, deleteFromGridFS } = require('../utils/imageStorage');

async function findUserById(userId) {
  return User.findById(userId);
}

async function updateProfile(userId, { name, email, bio }) {
  const user = await findUserById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  if (name !== undefined) {
    user.name = String(name).trim();
  }

  if (bio !== undefined) {
    user.bio = bio == null ? '' : String(bio).trim();
  }

  if (email !== undefined) {
    const normalized = String(email).trim().toLowerCase();
    if (normalized !== user.email) {
      const taken = await User.findOne({ email: normalized, _id: { $ne: user._id } });
      if (taken) {
        const err = new Error('Email already in use');
        err.status = 409;
        throw err;
      }
      user.email = normalized;
      if (user.authProvider === 'local') {
        user.isVerified = false;
      }
    }
  }

  await user.save();
  return user.toSafeObject();
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await findUserById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  if (user.authProvider !== 'local' || !user.passwordHash) {
    const err = new Error('Password cannot be changed for this account. Use Google sign-in.');
    err.status = 400;
    err.code = 'GOOGLE_ACCOUNT';
    throw err;
  }

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    const err = new Error('Current password is incorrect');
    err.status = 400;
    throw err;
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
}

async function replaceAvatar(userId, buffer, filename, contentType) {
  const user = await findUserById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const previousId = user.avatarFileId;
  const fileId = await uploadToGridFS(buffer, filename, contentType);
  user.avatarFileId = fileId;
  await user.save();

  if (previousId) {
    try {
      await deleteFromGridFS(previousId);
    } catch {
      // Old file may already be missing.
    }
  }

  return user.toSafeObject();
}

async function clearAvatar(userId) {
  const user = await findUserById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const previousId = user.avatarFileId;
  user.avatarFileId = null;
  await user.save();

  if (previousId) {
    try {
      await deleteFromGridFS(previousId);
    } catch {
      // Ignore missing file.
    }
  }

  return user.toSafeObject();
}

async function canViewAvatar(viewerId, targetUserId) {
  if (String(viewerId) === String(targetUserId)) {
    return true;
  }

  const viewer = new mongoose.Types.ObjectId(viewerId);
  const target = new mongoose.Types.ObjectId(targetUserId);
  const sharedMatch = await Match.exists({
    $or: [
      { sourceItemOwnerId: viewer, matchedItemOwnerId: target },
      { sourceItemOwnerId: target, matchedItemOwnerId: viewer },
    ],
  });

  return Boolean(sharedMatch);
}

module.exports = {
  findUserById,
  updateProfile,
  changePassword,
  replaceAvatar,
  clearAvatar,
  canViewAvatar,
};
