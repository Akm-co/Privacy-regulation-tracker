import { Router } from 'express';
import { Regulation, Update, Enforcement } from '../models/index.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';
import { cache } from '../config/redis.js';

const router = Router();

// Get all regulations
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    region,
    status,
    search,
    sort = '-effectiveDate',
    tags
  } = req.query;

  // Build query
  const query = {};

  if (region) {
    query['jurisdiction.region'] = region;
  }

  if (status) {
    query.status = status;
  }

  if (tags) {
    query.tags = { $in: tags.split(',') };
  }

  if (search) {
    query.$text = { $search: search };
  }

  // Check cache
  const cacheKey = `regulations:${JSON.stringify({ query, page, limit, sort })}`;
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  // Execute query
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [regulations, total] = await Promise.all([
    Regulation.find(query)
      .select('-keyArticles.fullText')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Regulation.countDocuments(query)
  ]);

  const response = {
    success: true,
    data: regulations,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  };

  // Cache for 5 minutes
  await cache.set(cacheKey, response, 300);

  res.json(response);
}));

// Get single regulation
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const cacheKey = `regulation:${id}`;
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  const regulation = await Regulation.findById(id)
    .populate('relatedRegulations', 'name acronym jurisdiction.region');

  if (!regulation) {
    throw new NotFoundError('Regulation');
  }

  // Increment view count
  await Regulation.findByIdAndUpdate(id, {
    $inc: { 'metadata.viewCount': 1 }
  });

  const response = {
    success: true,
    data: regulation
  };

  // Cache for 10 minutes
  await cache.set(cacheKey, response, 600);

  res.json(response);
}));

// Get updates for a regulation
router.get('/:id/updates', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20, type, impact } = req.query;

  const query = { regulations: id };

  if (type) {
    query.updateType = type;
  }

  if (impact) {
    query.impactLevel = impact;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [updates, total] = await Promise.all([
    Update.find(query)
      .select('title summary sourceUrl sourceName publicationDate updateType impactLevel regions')
      .sort('-publicationDate')
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Update.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: updates,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// Get enforcements for a regulation
router.get('/:id/enforcements', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20, sort = '-date' } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [enforcements, total] = await Promise.all([
    Enforcement.find({ regulation: id })
      .select('company fineAmount currency fineAmountUSD authority country date summary')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Enforcement.countDocuments({ regulation: id })
  ]);

  res.json({
    success: true,
    data: enforcements,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// Compare regulations
router.get('/compare', optionalAuth, asyncHandler(async (req, res) => {
  const { ids } = req.query;

  if (!ids) {
    throw new ValidationError([{ field: 'ids', message: 'Regulation IDs required' }]);
  }

  const regulationIds = ids.split(',').slice(0, 4); // Max 4 comparisons

  const regulations = await Regulation.find({
    _id: { $in: regulationIds }
  }).select('name fullName acronym jurisdiction effectiveDate status strictnessScore keyRequirements dataSubjectRights controllerObligations crossBorderRules notificationRequirements finesStructure');

  // Build comparison matrix
  const comparisonCategories = [
    'dataSubjectRights',
    'controllerObligations',
    'crossBorderRules',
    'notificationRequirements',
    'finesStructure'
  ];

  const comparison = {
    regulations: regulations,
    matrix: {}
  };

  comparisonCategories.forEach(category => {
    comparison.matrix[category] = regulations.map(r => ({
      regulationId: r._id,
      regulationName: r.name,
      data: r[category]
    }));
  });

  res.json({
    success: true,
    data: comparison
  });
}));

// Get regulation statistics
router.get('/:id/stats', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [updatesCount, enforcementsCount, totalFines, recentUpdates] = await Promise.all([
    Update.countDocuments({ regulations: id }),
    Enforcement.countDocuments({ regulation: id }),
    Enforcement.aggregate([
      { $match: { regulation: mongoose.Types.ObjectId(id) } },
      { $group: { _id: null, total: { $sum: '$fineAmountUSD' } } }
    ]),
    Update.find({ regulations: id })
      .sort('-publicationDate')
      .limit(5)
      .select('title publicationDate updateType')
  ]);

  res.json({
    success: true,
    data: {
      updatesCount,
      enforcementsCount,
      totalFinesUSD: totalFines[0]?.total || 0,
      recentUpdates
    }
  });
}));

// Get all unique tags
router.get('/meta/tags', asyncHandler(async (req, res) => {
  const cacheKey = 'regulations:tags';
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  const tags = await Regulation.distinct('tags');

  const response = {
    success: true,
    data: tags.sort()
  };

  await cache.set(cacheKey, response, 3600); // Cache for 1 hour

  res.json(response);
}));

// Get regulations by region
router.get('/by-region/:regionCode', optionalAuth, asyncHandler(async (req, res) => {
  const { regionCode } = req.params;

  const regulations = await Regulation.find({
    $or: [
      { 'jurisdiction.region': regionCode },
      { 'jurisdiction.countries.code': regionCode }
    ],
    status: 'active'
  })
    .select('name acronym fullName summary effectiveDate strictnessScore tags')
    .sort('-strictnessScore');

  res.json({
    success: true,
    data: regulations
  });
}));

export default router;
