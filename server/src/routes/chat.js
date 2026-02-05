import { Router } from 'express';
import { ChatSession, Regulation, Update } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { chatLimiter, proChatLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// AI service integration
const getAIResponse = async (messages, context, user) => {
  const aiProvider = process.env.AI_PROVIDER || 'openai';

  const systemPrompt = `You are RegBot, an AI assistant specializing in global privacy regulations and data protection laws. You help users understand regulations like GDPR, CCPA, LGPD, PIPL, and many others.

Your capabilities:
- Explain regulations in plain language
- Compare requirements across jurisdictions
- Answer compliance questions
- Summarize recent regulatory changes
- Provide guidance on data protection best practices

Important guidelines:
- Always cite specific regulation articles when relevant
- Acknowledge when you're uncertain and recommend consulting legal counsel
- Be concise but thorough
- Focus on practical, actionable advice
- Consider the user's context: ${context.industry ? `Industry: ${context.industry}` : 'Not specified'}
- User's watched regions: ${context.watchedRegions?.join(', ') || 'Not specified'}

You have access to a comprehensive database of privacy regulations and recent updates. When discussing specific requirements, reference the relevant articles and sections.`;

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({
      role: m.role,
      content: m.content
    }))
  ];

  try {
    if (aiProvider === 'anthropic') {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const response = await client.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2048,
        system: systemPrompt,
        messages: formattedMessages.slice(1).map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      });

      return {
        content: response.content[0].text,
        model: response.model,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens
      };
    } else {
      // OpenAI
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: formattedMessages,
        max_tokens: 2048,
        temperature: 0.7
      });

      return {
        content: response.choices[0].message.content,
        model: response.model,
        tokensUsed: response.usage.total_tokens
      };
    }
  } catch (error) {
    logger.error('AI API error:', error);
    throw new Error('Failed to get AI response');
  }
};

// Find relevant sources for citations
const findRelevantSources = async (query, regulationIds = []) => {
  const sources = [];

  // Search regulations
  const regulations = await Regulation.find({
    $or: [
      { _id: { $in: regulationIds } },
      { $text: { $search: query } }
    ]
  })
    .limit(3)
    .select('name acronym fullTextUrl keyArticles');

  regulations.forEach(reg => {
    sources.push({
      title: reg.name,
      url: reg.fullTextUrl,
      regulationId: reg._id
    });
  });

  // Search recent updates
  const updates = await Update.find({
    $text: { $search: query }
  })
    .sort({ publicationDate: -1 })
    .limit(3)
    .select('title sourceUrl');

  updates.forEach(update => {
    sources.push({
      title: update.title,
      url: update.sourceUrl,
      updateId: update._id
    });
  });

  return sources;
};

// Send a message and get AI response
router.post('/', authenticate, chatLimiter, asyncHandler(async (req, res) => {
  const { message, sessionId, context: userContext } = req.body;

  if (!message?.trim()) {
    throw new ValidationError([{ field: 'message', message: 'Message is required' }]);
  }

  let session;

  if (sessionId) {
    session = await ChatSession.findOne({
      _id: sessionId,
      userId: req.user._id,
      status: 'active'
    });

    if (!session) {
      throw new NotFoundError('Chat session');
    }
  } else {
    // Create new session
    session = new ChatSession({
      userId: req.user._id,
      context: {
        watchedRegions: req.user.preferences?.watchedRegions || [],
        watchedRegulations: req.user.preferences?.watchedRegulations || [],
        industry: req.user.industry,
        ...userContext
      }
    });
  }

  // Add user message
  session.addMessage('user', message);

  // Get conversation context
  const conversationContext = session.getConversationContext(10);

  // Get AI response
  const startTime = Date.now();
  const aiResponse = await getAIResponse(
    conversationContext,
    session.context,
    req.user
  );
  const latency = Date.now() - startTime;

  // Find relevant sources
  const sources = await findRelevantSources(
    message,
    session.context.referencedRegulations
  );

  // Add assistant message
  session.addMessage('assistant', aiResponse.content, {
    sources,
    metadata: {
      model: aiResponse.model,
      tokensUsed: aiResponse.tokensUsed,
      latency
    }
  });

  await session.save();

  res.json({
    success: true,
    data: {
      sessionId: session._id,
      message: {
        role: 'assistant',
        content: aiResponse.content,
        sources,
        timestamp: new Date()
      }
    }
  });
}));

// Get chat history
router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [sessions, total] = await Promise.all([
    ChatSession.find({
      userId: req.user._id,
      status: { $ne: 'deleted' }
    })
      .sort('-lastMessageAt')
      .skip(skip)
      .limit(parseInt(limit))
      .select('title lastMessageAt stats.messageCount pinned status')
      .lean(),
    ChatSession.countDocuments({
      userId: req.user._id,
      status: { $ne: 'deleted' }
    })
  ]);

  res.json({
    success: true,
    data: sessions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// Get specific session
router.get('/session/:id', authenticate, asyncHandler(async (req, res) => {
  const session = await ChatSession.findOne({
    _id: req.params.id,
    userId: req.user._id
  })
    .populate('context.referencedRegulations', 'name acronym')
    .populate('context.referencedUpdates', 'title sourceUrl');

  if (!session) {
    throw new NotFoundError('Chat session');
  }

  res.json({
    success: true,
    data: session
  });
}));

// Update session (title, pinned, etc.)
router.put('/session/:id', authenticate, asyncHandler(async (req, res) => {
  const { title, pinned } = req.body;

  const updates = {};
  if (title !== undefined) updates.title = title;
  if (pinned !== undefined) updates.pinned = pinned;

  const session = await ChatSession.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: updates },
    { new: true }
  );

  if (!session) {
    throw new NotFoundError('Chat session');
  }

  res.json({
    success: true,
    data: session
  });
}));

// Delete session
router.delete('/session/:id', authenticate, asyncHandler(async (req, res) => {
  const session = await ChatSession.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { status: 'deleted' },
    { new: true }
  );

  if (!session) {
    throw new NotFoundError('Chat session');
  }

  res.json({
    success: true,
    message: 'Session deleted'
  });
}));

// Provide feedback on a message
router.post('/session/:sessionId/feedback/:messageId', authenticate, asyncHandler(async (req, res) => {
  const { sessionId, messageId } = req.params;
  const { rating, helpful, comment } = req.body;

  const session = await ChatSession.findOne({
    _id: sessionId,
    userId: req.user._id
  });

  if (!session) {
    throw new NotFoundError('Chat session');
  }

  const message = session.messages.id(messageId);
  if (!message) {
    throw new NotFoundError('Message');
  }

  message.feedback = {
    rating,
    helpful,
    comment
  };

  await session.save();

  res.json({
    success: true,
    message: 'Feedback recorded'
  });
}));

// Quick question (no session)
router.post('/quick', authenticate, chatLimiter, asyncHandler(async (req, res) => {
  const { question } = req.body;

  if (!question?.trim()) {
    throw new ValidationError([{ field: 'question', message: 'Question is required' }]);
  }

  const context = {
    watchedRegions: req.user.preferences?.watchedRegions || [],
    industry: req.user.industry
  };

  const aiResponse = await getAIResponse(
    [{ role: 'user', content: question }],
    context,
    req.user
  );

  const sources = await findRelevantSources(question);

  res.json({
    success: true,
    data: {
      answer: aiResponse.content,
      sources
    }
  });
}));

// Suggested questions based on context
router.get('/suggestions', authenticate, asyncHandler(async (req, res) => {
  const { watchedRegions, watchedRegulations } = req.user.preferences || {};

  const suggestions = [
    'What are the key differences between GDPR and CCPA?',
    'How do I conduct a Data Protection Impact Assessment (DPIA)?',
    'What are the data breach notification requirements under GDPR?',
    'How should I obtain valid consent for data processing?'
  ];

  // Add personalized suggestions based on watched regions
  if (watchedRegions?.includes('US-CA')) {
    suggestions.push('What are the new requirements under CPRA amendments?');
  }
  if (watchedRegions?.includes('EU')) {
    suggestions.push('How does the AI Act affect my data processing activities?');
  }
  if (watchedRegions?.includes('UK')) {
    suggestions.push('What changes came with UK GDPR post-Brexit?');
  }

  res.json({
    success: true,
    data: suggestions.slice(0, 6)
  });
}));

export default router;
