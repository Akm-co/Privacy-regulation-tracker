import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  description: String,
  priority: {
    type: String,
    enum: ['critical', 'important', 'recommended'],
    default: 'important'
  },
  category: {
    type: String,
    enum: [
      'governance',
      'data-mapping',
      'legal-basis',
      'consent',
      'rights',
      'security',
      'breach',
      'dpia',
      'transfers',
      'contracts',
      'training',
      'documentation',
      'other'
    ]
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: Date,
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  dueDate: Date,
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assigneeName: String,
  notes: String,
  evidenceUrls: [{
    name: String,
    url: String,
    uploadedAt: Date
  }],
  regulationRef: {
    regulationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Regulation'
    },
    regulationName: String,
    article: String,
    articleText: String
  },
  subItems: [{
    text: String,
    completed: { type: Boolean, default: false },
    completedAt: Date
  }],
  order: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'blocked', 'not-applicable'],
    default: 'pending'
  },
  blockedReason: String
}, { _id: true });

const checklistSchema = new mongoose.Schema({
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
  regulations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Regulation'
  }],
  industry: String,
  dataTypes: [String],
  geographicScope: [String],
  items: [checklistItemSchema],
  progress: {
    total: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    byPriority: {
      critical: { total: Number, completed: Number },
      important: { total: Number, completed: Number },
      recommended: { total: Number, completed: Number }
    },
    byCategory: mongoose.Schema.Types.Mixed
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChecklistTemplate'
  },
  templateName: String,
  customized: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'archived'],
    default: 'active'
  },
  visibility: {
    type: String,
    enum: ['private', 'team', 'organization'],
    default: 'private'
  },
  collaborators: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['viewer', 'editor', 'admin'],
      default: 'viewer'
    },
    addedAt: { type: Date, default: Date.now }
  }],
  dueDate: Date,
  completedAt: Date,
  tags: [String],
  exportHistory: [{
    format: String,
    exportedAt: Date,
    exportedBy: mongoose.Schema.Types.ObjectId
  }],
  aiGenerated: {
    type: Boolean,
    default: false
  },
  aiConfig: {
    prompt: String,
    model: String,
    generatedAt: Date
  }
}, {
  timestamps: true
});

// Indexes
checklistSchema.index({ userId: 1, status: 1 });
checklistSchema.index({ regulations: 1 });
checklistSchema.index({ templateId: 1 });

// Pre-save hook to calculate progress
checklistSchema.pre('save', function(next) {
  const items = this.items;
  const total = items.length;
  const completed = items.filter(i => i.completed || i.status === 'completed').length;

  // Calculate by priority
  const byPriority = {
    critical: { total: 0, completed: 0 },
    important: { total: 0, completed: 0 },
    recommended: { total: 0, completed: 0 }
  };

  items.forEach(item => {
    const priority = item.priority || 'important';
    byPriority[priority].total++;
    if (item.completed || item.status === 'completed') {
      byPriority[priority].completed++;
    }
  });

  // Calculate by category
  const byCategory = {};
  items.forEach(item => {
    const category = item.category || 'other';
    if (!byCategory[category]) {
      byCategory[category] = { total: 0, completed: 0 };
    }
    byCategory[category].total++;
    if (item.completed || item.status === 'completed') {
      byCategory[category].completed++;
    }
  });

  this.progress = {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    byPriority,
    byCategory
  };

  // Update status if all items completed
  if (total > 0 && completed === total && this.status === 'active') {
    this.status = 'completed';
    this.completedAt = new Date();
  }

  next();
});

// Method to toggle item
checklistSchema.methods.toggleItem = function(itemId, userId) {
  const item = this.items.id(itemId);
  if (item) {
    item.completed = !item.completed;
    item.completedAt = item.completed ? new Date() : null;
    item.completedBy = item.completed ? userId : null;
    item.status = item.completed ? 'completed' : 'pending';
  }
  return this;
};

// Method to add item
checklistSchema.methods.addItem = function(itemData) {
  const maxOrder = Math.max(...this.items.map(i => i.order), -1);
  this.items.push({
    ...itemData,
    order: maxOrder + 1
  });
  this.customized = true;
  return this;
};

// Method to reorder items
checklistSchema.methods.reorderItems = function(itemIds) {
  itemIds.forEach((id, index) => {
    const item = this.items.id(id);
    if (item) {
      item.order = index;
    }
  });
  return this;
};

// Static method to get summary for user
checklistSchema.statics.getUserSummary = async function(userId) {
  const result = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: { $ne: 'archived' } } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProgress: { $avg: '$progress.percentage' }
      }
    }
  ]);

  return result.reduce((acc, item) => {
    acc[item._id] = { count: item.count, avgProgress: Math.round(item.avgProgress) };
    return acc;
  }, {});
};

const Checklist = mongoose.model('Checklist', checklistSchema);

export default Checklist;
