import mongoose from 'mongoose';
import crypto from 'crypto';

const updateSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true
  },
  summary: {
    type: String,
    required: true
  },
  content: {
    type: String
  },
  sourceUrl: {
    type: String,
    required: true,
    unique: true
  },
  sourceName: {
    type: String,
    required: true
  },
  sourceTier: {
    type: Number,
    enum: [1, 2, 3],
    default: 2
  },
  sourceId: {
    type: String,
    index: true
  },
  publicationDate: {
    type: Date,
    required: true,
    index: true
  },
  scrapedAt: {
    type: Date,
    default: Date.now
  },
  regions: [{
    code: {
      type: String,
      index: true
    },
    name: String
  }],
  regulations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Regulation',
    index: true
  }],
  updateType: {
    type: String,
    enum: ['amendment', 'guidance', 'enforcement', 'news', 'research', 'opinion', 'rulemaking', 'breach', 'policy'],
    required: true,
    index: true
  },
  impactLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  tags: [{
    type: String,
    index: true
  }],
  aiAnalysis: {
    keyChanges: [String],
    affectedSectors: [String],
    actionRequired: Boolean,
    complianceDeadline: Date,
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative', 'mixed']
    },
    summary: String,
    processedAt: Date,
    model: String
  },
  verified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  language: {
    type: String,
    default: 'en'
  },
  originalLanguage: String,
  translatedContent: {
    title: String,
    summary: String,
    content: String
  },
  relatedUpdates: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Update'
  }],
  metadata: {
    author: String,
    documentType: String,
    documentNumber: String,
    attachments: [{
      name: String,
      url: String,
      type: String
    }]
  },
  engagement: {
    viewCount: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 }
  },
  hash: {
    type: String,
    index: true
  }
}, {
  timestamps: true
});

// Text index for search
updateSchema.index({
  title: 'text',
  summary: 'text',
  content: 'text',
  tags: 'text'
});

// Compound indexes for common queries
updateSchema.index({ publicationDate: -1, impactLevel: 1 });
updateSchema.index({ 'regions.code': 1, publicationDate: -1 });
updateSchema.index({ updateType: 1, publicationDate: -1 });
updateSchema.index({ sourceTier: 1, publicationDate: -1 });

// Pre-save hook to generate content hash for deduplication
updateSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('content')) {
    this.hash = crypto
      .createHash('md5')
      .update(this.title + this.sourceUrl)
      .digest('hex');
  }
  next();
});

const Update = mongoose.model('Update', updateSchema);

export default Update;
