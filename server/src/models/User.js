import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  organization: {
    type: String,
    trim: true
  },
  jobTitle: String,
  industry: String,
  role: {
    type: String,
    enum: ['free', 'pro', 'enterprise', 'admin'],
    default: 'free'
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired', 'trial'],
      default: 'active'
    },
    startDate: Date,
    endDate: Date,
    stripeCustomerId: String,
    stripeSubscriptionId: String
  },
  preferences: {
    watchedRegions: [{
      type: String
    }],
    watchedRegulations: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Regulation'
    }],
    alertKeywords: [{
      type: String
    }],
    digestFrequency: {
      type: String,
      enum: ['instant', 'daily', 'weekly', 'none'],
      default: 'daily'
    },
    digestTime: {
      type: String,
      default: '09:00'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    language: {
      type: String,
      default: 'en'
    },
    emailNotifications: {
      updates: { type: Boolean, default: true },
      enforcements: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true },
      productNews: { type: Boolean, default: false }
    }
  },
  alerts: [{
    name: String,
    type: {
      type: String,
      enum: ['region', 'regulation', 'keyword', 'impact', 'enforcement']
    },
    config: {
      regions: [String],
      regulations: [mongoose.Schema.Types.ObjectId],
      keywords: [String],
      impactLevel: [String],
      updateTypes: [String]
    },
    channels: {
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      webhook: String
    },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  }],
  savedSearches: [{
    name: String,
    query: String,
    filters: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
  }],
  savedUpdates: [{
    update: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Update'
    },
    savedAt: { type: Date, default: Date.now },
    notes: String,
    folder: String
  }],
  recentlyViewed: [{
    itemType: {
      type: String,
      enum: ['update', 'regulation', 'enforcement']
    },
    itemId: mongoose.Schema.Types.ObjectId,
    viewedAt: { type: Date, default: Date.now }
  }],
  integrations: {
    slack: {
      webhookUrl: String,
      channel: String,
      enabled: { type: Boolean, default: false }
    },
    teams: {
      webhookUrl: String,
      enabled: { type: Boolean, default: false }
    },
    customWebhook: {
      url: String,
      headers: mongoose.Schema.Types.Mixed,
      enabled: { type: Boolean, default: false }
    }
  },
  apiAccess: {
    enabled: { type: Boolean, default: false },
    apiKey: String,
    apiKeyHash: String,
    rateLimit: { type: Number, default: 1000 },
    lastUsed: Date
  },
  verification: {
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: String,
    emailVerificationExpires: Date
  },
  passwordReset: {
    token: String,
    expires: Date
  },
  twoFactor: {
    enabled: { type: Boolean, default: false },
    secret: String,
    backupCodes: [String]
  },
  lastLogin: Date,
  loginHistory: [{
    date: Date,
    ip: String,
    userAgent: String,
    success: Boolean
  }],
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ 'preferences.watchedRegions': 1 });
userSchema.index({ 'subscription.plan': 1, status: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();

  // Only hash if not already hashed (check for bcrypt prefix)
  if (!this.passwordHash.startsWith('$2')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to check if user can access feature
userSchema.methods.canAccess = function(feature) {
  const features = {
    free: ['basic-search', 'view-updates', 'view-regulations', 'basic-alerts'],
    pro: ['advanced-search', 'ai-chat', 'export-pdf', 'custom-alerts', 'api-access'],
    enterprise: ['team-management', 'sso', 'custom-integrations', 'priority-support']
  };

  const userFeatures = [
    ...features.free,
    ...(this.role === 'pro' || this.role === 'enterprise' ? features.pro : []),
    ...(this.role === 'enterprise' ? features.enterprise : [])
  ];

  return userFeatures.includes(feature);
};

// Generate API key
userSchema.methods.generateApiKey = function() {
  const crypto = require('crypto');
  const apiKey = crypto.randomBytes(32).toString('hex');
  this.apiAccess.apiKey = apiKey;
  this.apiAccess.apiKeyHash = crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
  return apiKey;
};

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.verification;
  delete user.passwordReset;
  delete user.twoFactor;
  delete user.apiAccess?.apiKeyHash;
  delete user.loginHistory;
  return user;
};

const User = mongoose.model('User', userSchema);

export default User;
