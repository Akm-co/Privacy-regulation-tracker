import mongoose from 'mongoose';

const regulationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true
  },
  fullName: {
    type: String,
    required: true
  },
  acronym: {
    type: String,
    index: true
  },
  jurisdiction: {
    type: {
      type: String,
      enum: ['national', 'supranational', 'state', 'provincial'],
      required: true
    },
    region: {
      type: String,
      required: true,
      index: true
    },
    countries: [{
      code: String,
      name: String
    }]
  },
  effectiveDate: {
    type: Date,
    index: true
  },
  lastAmended: Date,
  status: {
    type: String,
    enum: ['active', 'proposed', 'repealed', 'draft', 'pending'],
    default: 'active',
    index: true
  },
  keyArticles: [{
    number: String,
    title: String,
    summary: String,
    fullText: String
  }],
  summary: {
    type: String,
    required: true
  },
  fullTextUrl: String,
  officialSource: String,
  tags: [{
    type: String,
    index: true
  }],
  strictnessScore: {
    type: Number,
    min: 1,
    max: 10
  },
  keyRequirements: [{
    category: String,
    requirement: String,
    description: String
  }],
  relatedRegulations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Regulation'
  }],
  enforcementAuthority: {
    name: String,
    url: String,
    contact: String
  },
  finesStructure: {
    maxFinePercent: Number,
    maxFineAmount: Number,
    currency: String,
    description: String
  },
  dataSubjectRights: [{
    right: String,
    description: String,
    articleRef: String
  }],
  controllerObligations: [{
    obligation: String,
    description: String,
    articleRef: String
  }],
  crossBorderRules: {
    adequacyRequired: Boolean,
    sccsAllowed: Boolean,
    bcrsAllowed: Boolean,
    otherMechanisms: [String],
    description: String
  },
  notificationRequirements: {
    breachNotificationRequired: Boolean,
    breachTimeframe: String,
    authorityNotification: Boolean,
    individualNotification: Boolean,
    description: String
  },
  metadata: {
    viewCount: { type: Number, default: 0 },
    lastScraped: Date,
    sourceId: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for search
regulationSchema.index({ name: 'text', fullName: 'text', summary: 'text' });
regulationSchema.index({ 'jurisdiction.region': 1, status: 1 });
regulationSchema.index({ tags: 1 });

// Virtual for updates count
regulationSchema.virtual('updates', {
  ref: 'Update',
  localField: '_id',
  foreignField: 'regulations'
});

// Virtual for enforcements count
regulationSchema.virtual('enforcements', {
  ref: 'Enforcement',
  localField: '_id',
  foreignField: 'regulation'
});

const Regulation = mongoose.model('Regulation', regulationSchema);

export default Regulation;
