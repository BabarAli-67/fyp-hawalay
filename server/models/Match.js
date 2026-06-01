const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    sourceItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    matchedItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    sourceItemOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    matchedItemOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

matchSchema.index({ sourceItemId: 1, matchedItemId: 1 }, { unique: true });
matchSchema.index({ sourceItemOwnerId: 1, matchedItemOwnerId: 1 });
matchSchema.index({ sourceItemOwnerId: 1, updatedAt: -1 });
matchSchema.index({ matchedItemOwnerId: 1, updatedAt: -1 });
matchSchema.index({ updatedAt: -1 });

const Match = mongoose.model('Match', matchSchema);

module.exports = Match;
