import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  sources: [{
    title: String,
    url: String,
    regulationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Regulation'
    },
    updateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Update'
    },
    snippet: String,
    articleRef: String
  }],
  metadata: {
    model: String,
    tokensUsed: Number,
    latency: Number,
    cached: Boolean
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    helpful: Boolean,
    comment: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const chatSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    default: 'New Conversation'
  },
  messages: [messageSchema],
  context: {
    watchedRegions: [String],
    watchedRegulations: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Regulation'
    }],
    referencedRegulations: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Regulation'
    }],
    referencedUpdates: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Update'
    }],
    industry: String,
    customContext: String
  },
  summary: String,
  tags: [String],
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  stats: {
    messageCount: { type: Number, default: 0 },
    userMessageCount: { type: Number, default: 0 },
    assistantMessageCount: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 }
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  pinned: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
chatSessionSchema.index({ userId: 1, lastMessageAt: -1 });
chatSessionSchema.index({ userId: 1, status: 1 });
chatSessionSchema.index({ 'context.referencedRegulations': 1 });

// Auto-generate title from first user message
chatSessionSchema.pre('save', function(next) {
  if (this.isNew || this.title === 'New Conversation') {
    const firstUserMessage = this.messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      // Truncate to first 50 chars or first sentence
      let title = firstUserMessage.content;
      const sentenceEnd = title.search(/[.!?]/);
      if (sentenceEnd > 0 && sentenceEnd < 60) {
        title = title.substring(0, sentenceEnd + 1);
      } else if (title.length > 50) {
        title = title.substring(0, 50) + '...';
      }
      this.title = title;
    }
  }

  // Update stats
  this.stats.messageCount = this.messages.length;
  this.stats.userMessageCount = this.messages.filter(m => m.role === 'user').length;
  this.stats.assistantMessageCount = this.messages.filter(m => m.role === 'assistant').length;

  next();
});

// Method to add a message
chatSessionSchema.methods.addMessage = function(role, content, options = {}) {
  const message = {
    role,
    content,
    sources: options.sources || [],
    metadata: options.metadata || {},
    timestamp: new Date()
  };

  this.messages.push(message);
  this.lastMessageAt = message.timestamp;

  if (options.metadata?.tokensUsed) {
    this.stats.totalTokens += options.metadata.tokensUsed;
  }

  // Update referenced items from sources
  if (options.sources) {
    options.sources.forEach(source => {
      if (source.regulationId && !this.context.referencedRegulations.includes(source.regulationId)) {
        this.context.referencedRegulations.push(source.regulationId);
      }
      if (source.updateId && !this.context.referencedUpdates.includes(source.updateId)) {
        this.context.referencedUpdates.push(source.updateId);
      }
    });
  }

  return this;
};

// Method to get conversation for AI context
chatSessionSchema.methods.getConversationContext = function(maxMessages = 20) {
  const recentMessages = this.messages.slice(-maxMessages);
  return recentMessages.map(m => ({
    role: m.role,
    content: m.content
  }));
};

// Method to archive old sessions
chatSessionSchema.statics.archiveOldSessions = async function(userId, daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.updateMany(
    {
      userId,
      status: 'active',
      lastMessageAt: { $lt: cutoffDate },
      pinned: false
    },
    { status: 'archived' }
  );
};

// Virtual for last message
chatSessionSchema.virtual('lastMessage').get(function() {
  if (this.messages.length > 0) {
    return this.messages[this.messages.length - 1];
  }
  return null;
});

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

export default ChatSession;
