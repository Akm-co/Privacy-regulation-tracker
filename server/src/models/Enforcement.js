import mongoose from 'mongoose';

const enforcementSchema = new mongoose.Schema({
  company: {
    type: String,
    required: true,
    index: true
  },
  companyType: {
    type: String,
    enum: ['corporation', 'sme', 'public-body', 'individual', 'non-profit', 'other']
  },
  industry: {
    type: String,
    index: true
  },
  fineAmount: {
    type: Number,
    required: true,
    index: true
  },
  currency: {
    type: String,
    required: true,
    default: 'EUR'
  },
  fineAmountUSD: {
    type: Number,
    index: true
  },
  fineAmountEUR: {
    type: Number,
    index: true
  },
  regulation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Regulation',
    required: true,
    index: true
  },
  authority: {
    type: String,
    required: true,
    index: true
  },
  authorityUrl: String,
  country: {
    type: String,
    required: true,
    index: true
  },
  countryName: String,
  date: {
    type: Date,
    required: true,
    index: true
  },
  announcementDate: Date,
  violations: [{
    article: String,
    description: String,
    category: {
      type: String,
      enum: [
        'lawful-basis',
        'consent',
        'data-subject-rights',
        'security',
        'breach-notification',
        'dpia',
        'international-transfer',
        'dpo',
        'record-keeping',
        'cooperation',
        'children-data',
        'special-categories',
        'automated-decisions',
        'other'
      ]
    }
  }],
  summary: {
    type: String,
    required: true
  },
  fullDescription: String,
  sourceUrl: {
    type: String,
    required: true
  },
  officialDecisionUrl: String,
  appealed: {
    type: Boolean,
    default: false
  },
  appealStatus: {
    type: String,
    enum: ['pending', 'won', 'lost', 'settled', 'withdrawn', 'n/a'],
    default: 'n/a'
  },
  appealOutcome: String,
  finalAmount: Number,
  correctedMeasures: [String],
  dataSubjectsAffected: Number,
  recordsAffected: Number,
  notable: {
    type: Boolean,
    default: false
  },
  notableReason: String,
  tags: [{
    type: String,
    index: true
  }],
  relatedEnforcements: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enforcement'
  }],
  metadata: {
    caseNumber: String,
    decisionReference: String,
    sourceId: String,
    scrapedAt: Date
  }
}, {
  timestamps: true
});

// Indexes
enforcementSchema.index({ date: -1, fineAmountUSD: -1 });
enforcementSchema.index({ country: 1, date: -1 });
enforcementSchema.index({ authority: 1, date: -1 });
enforcementSchema.index({ 'violations.category': 1 });
enforcementSchema.index({ company: 'text', summary: 'text' });

// Virtual for formatted fine
enforcementSchema.virtual('formattedFine').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency
  }).format(this.fineAmount);
});

// Pre-save hook to calculate USD/EUR amounts
enforcementSchema.pre('save', async function(next) {
  // In production, you'd use a currency conversion API
  // For now, using approximate rates
  const rates = {
    EUR: 1,
    USD: 0.92,
    GBP: 1.16,
    CHF: 1.05,
    PLN: 0.23,
    NOK: 0.087,
    SEK: 0.088,
    DKK: 0.13,
    HUF: 0.0026,
    CZK: 0.041,
    RON: 0.20,
    BGN: 0.51,
    HRK: 0.13,
    BRL: 0.19,
    AUD: 0.61,
    CAD: 0.69,
    SGD: 0.69,
    JPY: 0.0062,
    KRW: 0.00071,
    CNY: 0.13
  };

  const rate = rates[this.currency] || 1;
  this.fineAmountEUR = Math.round(this.fineAmount * rate);
  this.fineAmountUSD = Math.round(this.fineAmountEUR / 0.92);

  next();
});

const Enforcement = mongoose.model('Enforcement', enforcementSchema);

export default Enforcement;
