import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['executive', 'regional', 'enforcement', 'custom', 'compliance', 'trend'],
    required: true
  },
  config: {
    regions: [String],
    regulations: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Regulation'
    }],
    dateRange: {
      start: Date,
      end: Date
    },
    sections: [{
      type: String,
      enum: [
        'executive-summary',
        'regulatory-landscape',
        'recent-updates',
        'enforcement-actions',
        'compliance-status',
        'trend-analysis',
        'recommendations',
        'appendix'
      ]
    }],
    includeCharts: { type: Boolean, default: true },
    includeTableOfContents: { type: Boolean, default: true },
    detailLevel: {
      type: String,
      enum: ['brief', 'standard', 'detailed'],
      default: 'standard'
    },
    branding: {
      logo: String,
      primaryColor: String,
      secondaryColor: String,
      companyName: String,
      footerText: String
    },
    filters: {
      impactLevels: [String],
      updateTypes: [String],
      enforcementMinAmount: Number
    }
  },
  content: {
    executiveSummary: String,
    sections: [{
      title: String,
      content: String,
      charts: [{
        type: String,
        title: String,
        data: mongoose.Schema.Types.Mixed
      }],
      tables: [{
        title: String,
        headers: [String],
        rows: [[mongoose.Schema.Types.Mixed]]
      }]
    }],
    statistics: {
      totalUpdates: Number,
      totalEnforcements: Number,
      totalFines: Number,
      avgFine: Number,
      byRegion: mongoose.Schema.Types.Mixed,
      byType: mongoose.Schema.Types.Mixed
    },
    generatedBy: String
  },
  status: {
    type: String,
    enum: ['pending', 'generating', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  error: {
    message: String,
    stack: String,
    occurredAt: Date
  },
  fileUrl: String,
  fileSize: Number,
  format: {
    type: String,
    enum: ['pdf', 'docx', 'pptx', 'html'],
    default: 'pdf'
  },
  pageCount: Number,
  generatedAt: Date,
  generationDuration: Number,
  expiresAt: {
    type: Date,
    index: true
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloadedAt: Date,
  schedule: {
    enabled: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly']
    },
    dayOfWeek: Number,
    dayOfMonth: Number,
    time: String,
    timezone: String,
    nextRun: Date,
    lastRun: Date,
    emailTo: [String],
    includeLink: { type: Boolean, default: true },
    attachFile: { type: Boolean, default: false }
  },
  metadata: {
    requestedAt: Date,
    queuePosition: Number,
    workerId: String,
    aiModel: String,
    templateVersion: String
  },
  tags: [String],
  shared: {
    isShared: { type: Boolean, default: false },
    shareToken: String,
    shareExpires: Date,
    shareViews: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes
reportSchema.index({ userId: 1, status: 1, createdAt: -1 });
reportSchema.index({ 'schedule.enabled': 1, 'schedule.nextRun': 1 });
reportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Pre-save hook to set expiration
reportSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    // Reports expire after 30 days by default
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    this.expiresAt = expiry;
  }
  next();
});

// Method to generate share link
reportSchema.methods.generateShareLink = function(expirationDays = 7) {
  const crypto = require('crypto');
  this.shared.isShared = true;
  this.shared.shareToken = crypto.randomBytes(32).toString('hex');
  this.shared.shareExpires = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
  return this.shared.shareToken;
};

// Method to record download
reportSchema.methods.recordDownload = function() {
  this.downloadCount++;
  this.lastDownloadedAt = new Date();
  return this;
};

// Method to calculate next scheduled run
reportSchema.methods.calculateNextScheduledRun = function() {
  if (!this.schedule.enabled) return null;

  const now = new Date();
  let nextRun = new Date();

  switch (this.schedule.frequency) {
    case 'daily':
      nextRun.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      nextRun.setDate(now.getDate() + (7 - now.getDay() + this.schedule.dayOfWeek) % 7 || 7);
      break;
    case 'monthly':
      nextRun.setMonth(now.getMonth() + 1);
      nextRun.setDate(this.schedule.dayOfMonth || 1);
      break;
    case 'quarterly':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      nextRun.setMonth((currentQuarter + 1) * 3);
      nextRun.setDate(this.schedule.dayOfMonth || 1);
      break;
  }

  if (this.schedule.time) {
    const [hours, minutes] = this.schedule.time.split(':');
    nextRun.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  }

  this.schedule.nextRun = nextRun;
  return nextRun;
};

// Static method to get pending reports
reportSchema.statics.getPendingReports = function() {
  return this.find({
    status: 'pending'
  }).sort({ createdAt: 1 }).limit(10);
};

// Static method to get scheduled reports due
reportSchema.statics.getScheduledReportsDue = function() {
  return this.find({
    'schedule.enabled': true,
    'schedule.nextRun': { $lte: new Date() }
  });
};

// Static method to clean up expired reports
reportSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  return result.deletedCount;
};

const Report = mongoose.model('Report', reportSchema);

export default Report;
