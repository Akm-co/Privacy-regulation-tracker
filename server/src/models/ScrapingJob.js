import mongoose from 'mongoose';
import cronParser from 'cron-parser';

const scrapingJobSchema = new mongoose.Schema({
  source: {
    type: String,
    required: true,
    index: true
  },
  sourceId: {
    type: String,
    required: true,
    unique: true
  },
  sourceName: String,
  sourceUrl: String,
  tier: {
    type: Number,
    enum: [1, 2, 3]
  },
  type: {
    type: String,
    enum: ['rss', 'api', 'scrape'],
    required: true
  },
  region: String,
  schedule: {
    type: String,
    required: true
  },
  lastRun: {
    type: Date,
    index: true
  },
  nextRun: {
    type: Date,
    index: true
  },
  status: {
    type: String,
    enum: ['idle', 'running', 'success', 'failed', 'disabled'],
    default: 'idle',
    index: true
  },
  lastStatus: {
    type: String,
    enum: ['success', 'failed', 'partial']
  },
  runs: [{
    startTime: Date,
    endTime: Date,
    duration: Number,
    status: {
      type: String,
      enum: ['success', 'failed', 'partial']
    },
    itemsFound: Number,
    itemsNew: Number,
    itemsUpdated: Number,
    itemsSkipped: Number,
    errors: [{
      message: String,
      stack: String,
      timestamp: Date
    }],
    metadata: mongoose.Schema.Types.Mixed
  }],
  stats: {
    totalRuns: { type: Number, default: 0 },
    successfulRuns: { type: Number, default: 0 },
    failedRuns: { type: Number, default: 0 },
    totalItemsScraped: { type: Number, default: 0 },
    avgDuration: { type: Number, default: 0 },
    avgItemsPerRun: { type: Number, default: 0 },
    lastSuccessfulRun: Date,
    successRate: { type: Number, default: 0 }
  },
  config: {
    maxRetries: { type: Number, default: 3 },
    retryDelay: { type: Number, default: 5000 },
    timeout: { type: Number, default: 60000 },
    rateLimit: { type: Number, default: 1000 },
    userAgent: String,
    proxy: String,
    headers: mongoose.Schema.Types.Mixed,
    selectors: mongoose.Schema.Types.Mixed,
    keywords: [String],
    parser: String,
    rssUrl: String,
    apiUrl: String,
    newsUrl: String,
    queryParams: mongoose.Schema.Types.Mixed
  },
  enabled: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 5,
    min: 1,
    max: 10
  },
  alerts: {
    onFailure: { type: Boolean, default: true },
    onNoResults: { type: Boolean, default: false },
    consecutiveFailures: { type: Number, default: 3 },
    currentConsecutiveFailures: { type: Number, default: 0 }
  },
  healthCheck: {
    lastCheck: Date,
    isHealthy: { type: Boolean, default: true },
    issues: [String]
  }
}, {
  timestamps: true
});

// Indexes
scrapingJobSchema.index({ enabled: 1, nextRun: 1 });
scrapingJobSchema.index({ status: 1, priority: -1 });

// Method to record a run
scrapingJobSchema.methods.recordRun = function(runData) {
  const run = {
    startTime: runData.startTime,
    endTime: runData.endTime || new Date(),
    duration: runData.duration || (new Date() - runData.startTime),
    status: runData.status,
    itemsFound: runData.itemsFound || 0,
    itemsNew: runData.itemsNew || 0,
    itemsUpdated: runData.itemsUpdated || 0,
    itemsSkipped: runData.itemsSkipped || 0,
    errors: runData.errors || [],
    metadata: runData.metadata
  };

  // Keep only last 100 runs
  if (this.runs.length >= 100) {
    this.runs = this.runs.slice(-99);
  }
  this.runs.push(run);

  // Update stats
  this.stats.totalRuns++;
  if (run.status === 'success') {
    this.stats.successfulRuns++;
    this.stats.lastSuccessfulRun = run.endTime;
    this.alerts.currentConsecutiveFailures = 0;
  } else if (run.status === 'failed') {
    this.stats.failedRuns++;
    this.alerts.currentConsecutiveFailures++;
  }

  this.stats.totalItemsScraped += run.itemsNew + run.itemsUpdated;
  this.stats.avgDuration = Math.round(
    (this.stats.avgDuration * (this.stats.totalRuns - 1) + run.duration) / this.stats.totalRuns
  );
  this.stats.avgItemsPerRun = Math.round(
    this.stats.totalItemsScraped / this.stats.totalRuns
  );
  this.stats.successRate = Math.round(
    (this.stats.successfulRuns / this.stats.totalRuns) * 100
  );

  this.lastRun = run.endTime;
  this.lastStatus = run.status;

  return this;
};

// Method to calculate next run time
scrapingJobSchema.methods.calculateNextRun = function() {
  try {
    const interval = cronParser.parseExpression(this.schedule);
    this.nextRun = interval.next().toDate();
  } catch (err) {
    console.error(`Invalid cron expression for ${this.sourceId}:`, err.message);
  }
  return this;
};

// Static method to get due jobs
scrapingJobSchema.statics.getDueJobs = function() {
  return this.find({
    enabled: true,
    status: { $in: ['idle', 'failed'] },
    nextRun: { $lte: new Date() }
  }).sort({ priority: -1, nextRun: 1 });
};

// Static method to get health summary
scrapingJobSchema.statics.getHealthSummary = async function() {
  const total = await this.countDocuments({ enabled: true });
  const healthy = await this.countDocuments({
    enabled: true,
    'healthCheck.isHealthy': true
  });
  const failing = await this.countDocuments({
    enabled: true,
    'alerts.currentConsecutiveFailures': { $gte: 3 }
  });

  const byTier = await this.aggregate([
    { $match: { enabled: true } },
    {
      $group: {
        _id: '$tier',
        count: { $sum: 1 },
        avgSuccessRate: { $avg: '$stats.successRate' }
      }
    }
  ]);

  return {
    total,
    healthy,
    failing,
    healthPercentage: Math.round((healthy / total) * 100),
    byTier
  };
};

const ScrapingJob = mongoose.model('ScrapingJob', scrapingJobSchema);

export default ScrapingJob;
