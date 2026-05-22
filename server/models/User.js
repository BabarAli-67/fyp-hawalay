const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      default: null,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    // Omit when unset so sparse+unique only applies to real Google IDs (null would break uniqueness).
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    pushSubscription: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    avatarFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject();
  delete obj.passwordHash;
  if (obj.avatarFileId) {
    const version = obj.updatedAt ? new Date(obj.updatedAt).getTime() : 0;
    obj.avatarUrl = `/api/users/me/avatar?v=${version}`;
  } else {
    obj.avatarUrl = null;
  }
  delete obj.avatarFileId;
  return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
