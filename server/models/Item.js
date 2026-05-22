const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reportType: {
      type: String,
      enum: ['lost', 'found'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    brand: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    colors: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      enum: ['Electronics', 'Clothing', 'Documents', 'Accessories', 'Other'],
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },
    locationName: {
      type: String,
      required: true,
      trim: true,
    },
    secondaryLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },
    secondaryLocationName: {
      type: String,
      trim: true,
    },
    distinctiveFeatures: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    contactPreference: {
      type: String,
      enum: ['in_app_chat', 'show_email'],
      default: 'in_app_chat',
    },
    date: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      maxlength: 1000,
      trim: true,
    },
    caption: {
      type: String,
      trim: true,
    },
    ocrText: {
      type: String,
      trim: true,
    },
    embeddingVector: {
      type: [Number],
      default: undefined,
    },
    imageFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'claimed', 'expired'],
      default: 'active',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    claimedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

/** Drop invalid partial GeoJSON before save (avoids 2dsphere index errors). */
function stripInvalidPoint(doc, path) {
  const point = doc[path];
  if (!point) return;
  const coords = point.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2 || coords.some((n) => !Number.isFinite(n))) {
    doc.set(path, undefined);
  }
}

itemSchema.pre('validate', function stripPartialGeo(next) {
  stripInvalidPoint(this, 'secondaryLocation');
  next();
});

itemSchema.pre('save', function normalizeGeo(next) {
  stripInvalidPoint(this, 'secondaryLocation');
  next();
});

itemSchema.index({ location: '2dsphere' });
itemSchema.index({ secondaryLocation: '2dsphere' }, { sparse: true });
itemSchema.index({ brand: 1 });
itemSchema.index({ category: 1 });
itemSchema.index({ reportType: 1, status: 1 });
itemSchema.index({ ownerId: 1 });
itemSchema.index({ date: -1 });

const Item = mongoose.model('Item', itemSchema);

module.exports = Item;
