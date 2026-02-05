import { Router } from 'express';
import { Update, Regulation, Enforcement, User } from '../models/index.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { searchLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { cache } from '../config/redis.js';

const router = Router();

// Global search across all content
router.get('/', optionalAuth, searchLimiter, asyncHandler(async (req, res) => {
  const {
    q,
    type, // 'all', 'updates', 'regulations', 'enforcements'
    page = 1,
    limit = 20,
    region,
    startDate,
    endDate,
    sort = 'relevance'
  } = req.query;

  if (!q || q.length < 2) {
    return res.json({
      success: true,
      data: { updates: [], regulations: [], enforcements: [] },
      pagination: { total: 0 }
    });
  }

  const searchType = type || 'all';
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const results = {
    updates: [],
    regulations: [],
    enforcements: [],
    totals: {}
  };

  // Build base query
  const textQuery = { $text: { $search: q } };
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  // Search updates
  if (searchType === 'all' || searchType === 'updates') {
    const updateQuery = { ...textQuery };
    if (region) updateQuery['regions.code'] = region;
    if (Object.keys(dateFilter).length) updateQuery.publicationDate = dateFilter;

    const [updates, updateCount] = await Promise.all([
      Update.find(updateQuery, { score: { $meta: 'textScore' } })
        .sort(sort === 'relevance' ? { score: { $meta: 'textScore' } } : { publicationDate: -1 })
        .skip(searchType === 'updates' ? skip : 0)
        .limit(searchType === 'updates' ? parseInt(limit) : 5)
        .populate('regulations', 'name acronym')
        .select('title summary publicationDate updateType impactLevel regions sourceUrl')
        .lean(),
      Update.countDocuments(updateQuery)
    ]);

    results.updates = updates;
    results.totals.updates = updateCount;
  }

  // Search regulations
  if (searchType === 'all' || searchType === 'regulations') {
    const regQuery = { ...textQuery };
    if (region) regQuery['jurisdiction.region'] = region;

    const [regulations, regCount] = await Promise.all([
      Regulation.find(regQuery, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .skip(searchType === 'regulations' ? skip : 0)
        .limit(searchType === 'regulations' ? parseInt(limit) : 5)
        .select('name acronym fullName summary jurisdiction.region status effectiveDate')
        .lean(),
      Regulation.countDocuments(regQuery)
    ]);

    results.regulations = regulations;
    results.totals.regulations = regCount;
  }

  // Search enforcements
  if (searchType === 'all' || searchType === 'enforcements') {
    const enfQuery = { ...textQuery };
    if (region) enfQuery.country = region;
    if (Object.keys(dateFilter).length) enfQuery.date = dateFilter;

    const [enforcements, enfCount] = await Promise.all([
      Enforcement.find(enfQuery, { score: { $meta: 'textScore' } })
        .sort(sort === 'relevance' ? { score: { $meta: 'textScore' } } : { date: -1 })
        .skip(searchType === 'enforcements' ? skip : 0)
        .limit(searchType === 'enforcements' ? parseInt(limit) : 5)
        .populate('regulation', 'name acronym')
        .select('company fineAmountUSD authority country date summary')
        .lean(),
      Enforcement.countDocuments(enfQuery)
    ]);

    results.enforcements = enforcements;
    results.totals.enforcements = enfCount;
  }

  const total = (results.totals.updates || 0) +
    (results.totals.regulations || 0) +
    (results.totals.enforcements || 0);

  res.json({
    success: true,
    data: results,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totals: results.totals
    }
  });
}));

// Autocomplete/suggestions
router.get('/suggest', optionalAuth, asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;

  if (!q || q.length < 2) {
    return res.json({ success: true, data: [] });
  }

  const cacheKey = `suggest:${q.toLowerCase()}`;
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  // Get suggestions from different sources
  const [regulations, recentSearchTerms] = await Promise.all([
    // Regulation names/acronyms matching
    Regulation.find({
      $or: [
        { name: new RegExp(q, 'i') },
        { acronym: new RegExp(q, 'i') }
      ]
    })
      .limit(5)
      .select('name acronym')
      .lean(),

    // Common search terms (could be from a separate collection in production)
    getCommonSearchTerms(q)
  ]);

  const suggestions = [
    ...regulations.map(r => ({
      type: 'regulation',
      text: r.acronym ? `${r.name} (${r.acronym})` : r.name,
      value: r.name
    })),
    ...recentSearchTerms.map(term => ({
      type: 'term',
      text: term,
      value: term
    }))
  ].slice(0, parseInt(limit));

  const response = {
    success: true,
    data: suggestions
  };

  await cache.set(cacheKey, response, 300); // Cache for 5 minutes

  res.json(response);
}));

// Common search terms helper
async function getCommonSearchTerms(query) {
  // In production, this would query a search analytics collection
  const commonTerms = [
    'data breach notification',
    'consent requirements',
    'data subject rights',
    'cross-border transfer',
    'DPIA requirements',
    'legitimate interest',
    'privacy by design',
    'data retention',
    'right to erasure',
    'data minimization'
  ];

  return commonTerms
    .filter(term => term.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5);
}

// Advanced search
router.post('/advanced', optionalAuth, searchLimiter, asyncHandler(async (req, res) => {
  const {
    query,
    filters = {},
    page = 1,
    limit = 20,
    sort = { field: 'publicationDate', order: 'desc' }
  } = req.body;

  const {
    types = ['updates'],
    regions = [],
    regulations = [],
    impactLevels = [],
    updateTypes = [],
    dateRange = {},
    minFine,
    maxFine
  } = filters;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const results = {};

  // Search updates
  if (types.includes('updates')) {
    const updateQuery = {};

    if (query) {
      updateQuery.$text = { $search: query };
    }

    if (regions.length) {
      updateQuery['regions.code'] = { $in: regions };
    }

    if (regulations.length) {
      updateQuery.regulations = { $in: regulations };
    }

    if (impactLevels.length) {
      updateQuery.impactLevel = { $in: impactLevels };
    }

    if (updateTypes.length) {
      updateQuery.updateType = { $in: updateTypes };
    }

    if (dateRange.start || dateRange.end) {
      updateQuery.publicationDate = {};
      if (dateRange.start) updateQuery.publicationDate.$gte = new Date(dateRange.start);
      if (dateRange.end) updateQuery.publicationDate.$lte = new Date(dateRange.end);
    }

    const sortObj = {};
    if (query && sort.field === 'relevance') {
      sortObj.score = { $meta: 'textScore' };
    } else {
      sortObj[sort.field || 'publicationDate'] = sort.order === 'asc' ? 1 : -1;
    }

    const [updates, total] = await Promise.all([
      Update.find(
        updateQuery,
        query ? { score: { $meta: 'textScore' } } : {}
      )
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('regulations', 'name acronym')
        .lean(),
      Update.countDocuments(updateQuery)
    ]);

    results.updates = { items: updates, total };
  }

  // Search enforcements
  if (types.includes('enforcements')) {
    const enfQuery = {};

    if (query) {
      enfQuery.$text = { $search: query };
    }

    if (regions.length) {
      enfQuery.country = { $in: regions };
    }

    if (regulations.length) {
      enfQuery.regulation = { $in: regulations };
    }

    if (minFine !== undefined || maxFine !== undefined) {
      enfQuery.fineAmountUSD = {};
      if (minFine !== undefined) enfQuery.fineAmountUSD.$gte = minFine;
      if (maxFine !== undefined) enfQuery.fineAmountUSD.$lte = maxFine;
    }

    if (dateRange.start || dateRange.end) {
      enfQuery.date = {};
      if (dateRange.start) enfQuery.date.$gte = new Date(dateRange.start);
      if (dateRange.end) enfQuery.date.$lte = new Date(dateRange.end);
    }

    const sortObj = {};
    if (query && sort.field === 'relevance') {
      sortObj.score = { $meta: 'textScore' };
    } else {
      sortObj[sort.field === 'publicationDate' ? 'date' : (sort.field || 'date')] = sort.order === 'asc' ? 1 : -1;
    }

    const [enforcements, total] = await Promise.all([
      Enforcement.find(
        enfQuery,
        query ? { score: { $meta: 'textScore' } } : {}
      )
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('regulation', 'name acronym')
        .lean(),
      Enforcement.countDocuments(enfQuery)
    ]);

    results.enforcements = { items: enforcements, total };
  }

  // Search regulations
  if (types.includes('regulations')) {
    const regQuery = {};

    if (query) {
      regQuery.$text = { $search: query };
    }

    if (regions.length) {
      regQuery['jurisdiction.region'] = { $in: regions };
    }

    const [regs, total] = await Promise.all([
      Regulation.find(
        regQuery,
        query ? { score: { $meta: 'textScore' } } : {}
      )
        .sort(query ? { score: { $meta: 'textScore' } } : { name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Regulation.countDocuments(regQuery)
    ]);

    results.regulations = { items: regs, total };
  }

  res.json({
    success: true,
    data: results,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit)
    }
  });
}));

// Save search
router.post('/save', authenticate, asyncHandler(async (req, res) => {
  const { name, query, filters } = req.body;

  await User.findByIdAndUpdate(req.user._id, {
    $push: {
      savedSearches: {
        name: name || `Search: ${query}`,
        query,
        filters,
        createdAt: new Date()
      }
    }
  });

  res.json({
    success: true,
    message: 'Search saved'
  });
}));

// Get saved searches
router.get('/saved', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('savedSearches');

  res.json({
    success: true,
    data: user.savedSearches
  });
}));

// Delete saved search
router.delete('/saved/:searchId', authenticate, asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $pull: { savedSearches: { _id: req.params.searchId } }
  });

  res.json({
    success: true,
    message: 'Search deleted'
  });
}));

// Get search filters (facets)
router.get('/filters', optionalAuth, asyncHandler(async (req, res) => {
  const cacheKey = 'search:filters';
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  const [regions, updateTypes, impactLevels, regulations] = await Promise.all([
    Update.distinct('regions.code'),
    Update.distinct('updateType'),
    Update.distinct('impactLevel'),
    Regulation.find({ status: 'active' })
      .select('name acronym')
      .sort('name')
      .lean()
  ]);

  const response = {
    success: true,
    data: {
      regions: regions.filter(Boolean).sort(),
      updateTypes: updateTypes.filter(Boolean),
      impactLevels: ['critical', 'high', 'medium', 'low'],
      regulations: regulations.map(r => ({
        id: r._id,
        name: r.acronym ? `${r.acronym} - ${r.name}` : r.name
      }))
    }
  };

  await cache.set(cacheKey, response, 3600); // Cache for 1 hour

  res.json(response);
}));

export default router;
