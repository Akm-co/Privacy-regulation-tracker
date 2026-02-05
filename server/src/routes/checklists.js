import { Router } from 'express';
import { Checklist, Regulation } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, NotFoundError, ValidationError, ForbiddenError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Checklist templates
const checklistTemplates = {
  gdprController: {
    id: 'gdpr-controller',
    name: 'GDPR Data Controller Compliance',
    description: 'Comprehensive checklist for GDPR compliance as a data controller',
    regulations: ['GDPR'],
    items: [
      { text: 'Establish lawful basis for all processing activities', priority: 'critical', category: 'legal-basis' },
      { text: 'Create and maintain Records of Processing Activities (ROPA)', priority: 'critical', category: 'documentation' },
      { text: 'Implement consent mechanisms that meet GDPR standards', priority: 'critical', category: 'consent' },
      { text: 'Publish a GDPR-compliant privacy notice', priority: 'critical', category: 'documentation' },
      { text: 'Establish data subject rights request procedures', priority: 'critical', category: 'rights' },
      { text: 'Appoint a Data Protection Officer if required', priority: 'important', category: 'governance' },
      { text: 'Implement data breach notification procedures', priority: 'critical', category: 'breach' },
      { text: 'Conduct Data Protection Impact Assessments for high-risk processing', priority: 'important', category: 'dpia' },
      { text: 'Review and update data processing agreements with processors', priority: 'important', category: 'contracts' },
      { text: 'Implement appropriate technical and organizational security measures', priority: 'critical', category: 'security' },
      { text: 'Establish international transfer mechanisms if applicable', priority: 'important', category: 'transfers' },
      { text: 'Implement data minimization and retention policies', priority: 'important', category: 'governance' },
      { text: 'Train staff on data protection requirements', priority: 'important', category: 'training' },
      { text: 'Review third-party vendor data protection practices', priority: 'recommended', category: 'contracts' }
    ]
  },
  ccpaBusiness: {
    id: 'ccpa-business',
    name: 'CCPA/CPRA Business Compliance',
    description: 'Compliance checklist for California Consumer Privacy Act and CPRA amendments',
    regulations: ['CCPA', 'CPRA'],
    items: [
      { text: 'Determine if business meets CCPA thresholds', priority: 'critical', category: 'governance' },
      { text: 'Update privacy policy with required disclosures', priority: 'critical', category: 'documentation' },
      { text: 'Implement "Do Not Sell My Personal Information" link', priority: 'critical', category: 'rights' },
      { text: 'Create consumer request intake mechanisms', priority: 'critical', category: 'rights' },
      { text: 'Implement identity verification for consumer requests', priority: 'important', category: 'rights' },
      { text: 'Establish processes for right to know requests', priority: 'critical', category: 'rights' },
      { text: 'Establish processes for deletion requests', priority: 'critical', category: 'rights' },
      { text: 'Implement right to correct (CPRA)', priority: 'important', category: 'rights' },
      { text: 'Implement right to limit use of sensitive personal information (CPRA)', priority: 'critical', category: 'rights' },
      { text: 'Update service provider and contractor agreements', priority: 'important', category: 'contracts' },
      { text: 'Implement data minimization practices', priority: 'important', category: 'governance' },
      { text: 'Conduct annual risk assessments (CPRA)', priority: 'important', category: 'dpia' },
      { text: 'Train customer-facing staff on CCPA requirements', priority: 'important', category: 'training' },
      { text: 'Implement opt-in for minors under 16', priority: 'important', category: 'consent' }
    ]
  },
  dpiaTemplate: {
    id: 'dpia-template',
    name: 'Data Protection Impact Assessment',
    description: 'Step-by-step checklist for conducting a DPIA',
    regulations: ['GDPR'],
    items: [
      { text: 'Identify need for DPIA (systematic assessment of threshold criteria)', priority: 'critical', category: 'dpia' },
      { text: 'Describe the processing operation and purposes', priority: 'critical', category: 'documentation' },
      { text: 'Assess necessity and proportionality', priority: 'critical', category: 'dpia' },
      { text: 'Identify and assess risks to data subjects', priority: 'critical', category: 'dpia' },
      { text: 'Identify measures to mitigate risks', priority: 'critical', category: 'dpia' },
      { text: 'Consult with DPO', priority: 'important', category: 'governance' },
      { text: 'Consult with data subjects or representatives if appropriate', priority: 'recommended', category: 'dpia' },
      { text: 'Document the assessment and conclusions', priority: 'critical', category: 'documentation' },
      { text: 'Integrate DPIA outcomes into processing design', priority: 'important', category: 'dpia' },
      { text: 'Consult supervisory authority if high residual risk', priority: 'important', category: 'governance' },
      { text: 'Schedule DPIA review date', priority: 'important', category: 'governance' }
    ]
  },
  crossBorderTransfer: {
    id: 'cross-border-transfer',
    name: 'International Data Transfer Assessment',
    description: 'Checklist for assessing and implementing lawful cross-border data transfers',
    regulations: ['GDPR', 'UK GDPR'],
    items: [
      { text: 'Map all international data transfers', priority: 'critical', category: 'data-mapping' },
      { text: 'Assess adequacy status of destination countries', priority: 'critical', category: 'transfers' },
      { text: 'Implement Standard Contractual Clauses where needed', priority: 'critical', category: 'transfers' },
      { text: 'Conduct Transfer Impact Assessment', priority: 'critical', category: 'dpia' },
      { text: 'Assess third country laws and practices', priority: 'important', category: 'transfers' },
      { text: 'Implement supplementary measures if needed', priority: 'important', category: 'security' },
      { text: 'Document transfer assessment and justification', priority: 'important', category: 'documentation' },
      { text: 'Update privacy notices to reflect transfers', priority: 'important', category: 'documentation' },
      { text: 'Review Binding Corporate Rules if applicable', priority: 'recommended', category: 'transfers' },
      { text: 'Monitor changes in adequacy decisions', priority: 'recommended', category: 'governance' }
    ]
  }
};

// Get all checklists for user
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  const query = { userId: req.user._id };
  if (status) {
    query.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [checklists, total] = await Promise.all([
    Checklist.find(query)
      .populate('regulations', 'name acronym')
      .sort('-updatedAt')
      .skip(skip)
      .limit(parseInt(limit))
      .select('title description status progress dueDate createdAt updatedAt'),
    Checklist.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: checklists,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// Get checklist templates
router.get('/templates', authenticate, asyncHandler(async (req, res) => {
  const templates = Object.values(checklistTemplates).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    regulations: t.regulations,
    itemCount: t.items.length
  }));

  res.json({
    success: true,
    data: templates
  });
}));

// Generate checklist from template or AI
router.post('/generate', authenticate, asyncHandler(async (req, res) => {
  const { templateId, regulations, industry, dataTypes, geographicScope, customPrompt } = req.body;

  let checklist;

  if (templateId) {
    // Generate from template
    const template = checklistTemplates[templateId] || Object.values(checklistTemplates).find(t => t.id === templateId);

    if (!template) {
      throw new NotFoundError('Template');
    }

    // Find regulation IDs
    const regulationDocs = await Regulation.find({
      $or: [
        { name: { $in: template.regulations } },
        { acronym: { $in: template.regulations } }
      ]
    }).select('_id');

    checklist = new Checklist({
      userId: req.user._id,
      title: template.name,
      description: template.description,
      regulations: regulationDocs.map(r => r._id),
      industry,
      dataTypes,
      geographicScope,
      templateId: template.id,
      templateName: template.name,
      items: template.items.map((item, index) => ({
        ...item,
        order: index
      }))
    });
  } else if (regulations?.length || customPrompt) {
    // AI-generated checklist
    checklist = new Checklist({
      userId: req.user._id,
      title: 'Custom Compliance Checklist',
      description: customPrompt || `Compliance checklist for ${regulations?.join(', ')}`,
      regulations,
      industry,
      dataTypes,
      geographicScope,
      aiGenerated: true,
      aiConfig: {
        prompt: customPrompt,
        generatedAt: new Date()
      },
      items: [] // Would be populated by AI
    });

    // TODO: Implement AI checklist generation
    // For now, use a basic template
    const basicItems = [
      { text: 'Review applicable privacy regulations', priority: 'critical', category: 'governance' },
      { text: 'Conduct data mapping exercise', priority: 'critical', category: 'data-mapping' },
      { text: 'Establish lawful basis for processing', priority: 'critical', category: 'legal-basis' },
      { text: 'Update privacy notices', priority: 'important', category: 'documentation' },
      { text: 'Implement data subject rights procedures', priority: 'important', category: 'rights' },
      { text: 'Review data security measures', priority: 'important', category: 'security' },
      { text: 'Train staff on compliance requirements', priority: 'recommended', category: 'training' }
    ];

    checklist.items = basicItems.map((item, index) => ({
      ...item,
      order: index
    }));
  } else {
    throw new ValidationError([
      { field: 'templateId', message: 'Template ID or regulations required' }
    ]);
  }

  await checklist.save();

  res.status(201).json({
    success: true,
    data: checklist
  });
}));

// Get single checklist
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const checklist = await Checklist.findOne({
    _id: req.params.id,
    $or: [
      { userId: req.user._id },
      { 'collaborators.userId': req.user._id }
    ]
  }).populate('regulations', 'name acronym fullName');

  if (!checklist) {
    throw new NotFoundError('Checklist');
  }

  res.json({
    success: true,
    data: checklist
  });
}));

// Update checklist
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { title, description, dueDate, status } = req.body;

  const checklist = await Checklist.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!checklist) {
    throw new NotFoundError('Checklist');
  }

  if (title) checklist.title = title;
  if (description) checklist.description = description;
  if (dueDate) checklist.dueDate = dueDate;
  if (status) checklist.status = status;

  await checklist.save();

  res.json({
    success: true,
    data: checklist
  });
}));

// Delete checklist
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const checklist = await Checklist.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!checklist) {
    throw new NotFoundError('Checklist');
  }

  res.json({
    success: true,
    message: 'Checklist deleted'
  });
}));

// Toggle/update checklist item
router.put('/:id/items/:itemId', authenticate, asyncHandler(async (req, res) => {
  const { completed, status, notes, dueDate, assignee } = req.body;

  const checklist = await Checklist.findOne({
    _id: req.params.id,
    $or: [
      { userId: req.user._id },
      { 'collaborators.userId': req.user._id, 'collaborators.role': { $in: ['editor', 'admin'] } }
    ]
  });

  if (!checklist) {
    throw new NotFoundError('Checklist');
  }

  const item = checklist.items.id(req.params.itemId);
  if (!item) {
    throw new NotFoundError('Checklist item');
  }

  if (completed !== undefined) {
    item.completed = completed;
    item.completedAt = completed ? new Date() : null;
    item.completedBy = completed ? req.user._id : null;
    item.status = completed ? 'completed' : 'pending';
  }

  if (status) item.status = status;
  if (notes !== undefined) item.notes = notes;
  if (dueDate !== undefined) item.dueDate = dueDate;
  if (assignee !== undefined) item.assignee = assignee;

  checklist.customized = true;
  await checklist.save();

  res.json({
    success: true,
    data: item
  });
}));

// Add item to checklist
router.post('/:id/items', authenticate, asyncHandler(async (req, res) => {
  const { text, priority, category, dueDate } = req.body;

  if (!text) {
    throw new ValidationError([{ field: 'text', message: 'Item text is required' }]);
  }

  const checklist = await Checklist.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!checklist) {
    throw new NotFoundError('Checklist');
  }

  checklist.addItem({
    text,
    priority: priority || 'important',
    category: category || 'other',
    dueDate
  });

  await checklist.save();

  res.status(201).json({
    success: true,
    data: checklist.items[checklist.items.length - 1]
  });
}));

// Remove item from checklist
router.delete('/:id/items/:itemId', authenticate, asyncHandler(async (req, res) => {
  const checklist = await Checklist.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!checklist) {
    throw new NotFoundError('Checklist');
  }

  const item = checklist.items.id(req.params.itemId);
  if (!item) {
    throw new NotFoundError('Checklist item');
  }

  item.remove();
  checklist.customized = true;
  await checklist.save();

  res.json({
    success: true,
    message: 'Item removed'
  });
}));

// Reorder items
router.put('/:id/reorder', authenticate, asyncHandler(async (req, res) => {
  const { itemIds } = req.body;

  if (!Array.isArray(itemIds)) {
    throw new ValidationError([{ field: 'itemIds', message: 'Item IDs array required' }]);
  }

  const checklist = await Checklist.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!checklist) {
    throw new NotFoundError('Checklist');
  }

  checklist.reorderItems(itemIds);
  await checklist.save();

  res.json({
    success: true,
    data: checklist
  });
}));

// Add collaborator
router.post('/:id/collaborators', authenticate, asyncHandler(async (req, res) => {
  const { userId, role } = req.body;

  const checklist = await Checklist.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!checklist) {
    throw new NotFoundError('Checklist');
  }

  // Check if already a collaborator
  const existing = checklist.collaborators.find(
    c => c.userId.toString() === userId
  );

  if (existing) {
    existing.role = role;
  } else {
    checklist.collaborators.push({
      userId,
      role: role || 'viewer'
    });
  }

  await checklist.save();

  res.json({
    success: true,
    data: checklist.collaborators
  });
}));

// Get user's checklist summary
router.get('/stats/summary', authenticate, asyncHandler(async (req, res) => {
  const summary = await Checklist.getUserSummary(req.user._id);

  res.json({
    success: true,
    data: summary
  });
}));

export default router;
