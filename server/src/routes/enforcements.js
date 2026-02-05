import { Router } from 'express';
import mongoose from 'mongoose';
import { Enforcement } from '../models/index.js';
import { optionalAuth } from '../middleware/auth.js';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';
import { cache } from '../config/redis.js';

const router = Router();

// Get all enforcements
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    country,
    authority,
    regulation,
    minFine,
    maxFine,
    violation,
    startDate,
    endDate,
    company,
    sort = '-date'
  } = req.query;

  const query = {};

  if (country) {
    query.country = { $in: country.split(',') };
  }

  if (authority) {
    query.authority = new RegExp(authority, 'i');
  }

  if (regulation) {
    query.regulation = regulation;
  }

  if (minFine || maxFine) {
    query.fineAmountUSD = {};
    if (minFine) query.fineAmountUSD.$gte = parseInt(minFine);
    if (maxFine) query.fineAmountUSD.$lte = parseInt(maxFine);
  }

  if (violation) {
    query['violations.category'] = violation;
  }

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  if (company) {
    query.company = new RegExp(company, 'i');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [enforcements, total] = await Promise.all([
    Enforcement.find(query)
      .populate('regulation', 'name acronym')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Enforcement.countDocuments(query)
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

// Get single enforcement
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const enforcement = await Enforcement.findById(req.params.id)
    .populate('regulation', 'name acronym fullName jurisdiction')
    .populate('relatedEnforcements', 'company fineAmountUSD date');

  if (!enforcement) {
    throw new NotFoundError('Enforcement');
  }

  res.json({
    success: true,
    data: enforcement
  });
}));

// Get enforcement statistics
router.get('/stats/summary', optionalAuth, asyncHandler(async (req, res) => {
  const cacheKey = 'enforcements:stats';
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);

  const [
    totalCount,
    yearCount,
    totalFines,
    yearFines,
    byCountry,
    byViolation,
    byMonth,
    topFines
  ] = await Promise.all([
    // Total count
    Enforcement.countDocuments(),

    // This year count
    Enforcement.countDocuments({ date: { $gte: yearStart } }),

    // Total fines
    Enforcement.aggregate([
      { $group: { _id: null, total: { $sum: '$fineAmountUSD' } } }
    ]),

    // This year fines
    Enforcement.aggregate([
      { $match: { date: { $gte: yearStart } } },
      { $group: { _id: null, total: { $sum: '$fineAmountUSD' } } }
    ]),

    // By country
    Enforcement.aggregate([
      { $group: { _id: '$country', count: { $sum: 1 }, total: { $sum: '$fineAmountUSD' } } },
      { $sort: { total: -1 } },
      { $limit: 10 }
    ]),

    // By violation type
    Enforcement.aggregate([
      { $unwind: '$violations' },
      { $group: { _id: '$violations.category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),

    // By month (last 12 months)
    Enforcement.aggregate([
      {
        $match: {
          date: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          count: { $sum: 1 },
          total: { $sum: '$fineAmountUSD' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),

    // Top fines
    Enforcement.find()
      .sort('-fineAmountUSD')
      .limit(10)
      .select('company fineAmountUSD currency authority country date')
      .populate('regulation', 'name acronym')
      .lean()
  ]);

  const response = {
    success: true,
    data: {
      totalCount,
      yearCount,
      totalFinesUSD: totalFines[0]?.total || 0,
      yearFinesUSD: yearFines[0]?.total || 0,
      avgFineUSD: totalCount > 0 ? Math.round((totalFines[0]?.total || 0) / totalCount) : 0,
      byCountry,
      byViolation,
      byMonth: byMonth.map(m => ({
        month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
        count: m.count,
        total: m.total
      })),
      topFines
    }
  };

  await cache.set(cacheKey, response, 600); // Cache for 10 minutes

  res.json(response);
}));

// Get top fines
router.get('/top/list', optionalAuth, asyncHandler(async (req, res) => {
  const { limit = 10, year } = req.query;

  const query = {};
  if (year) {
    const yearStart = new Date(parseInt(year), 0, 1);
    const yearEnd = new Date(parseInt(year) + 1, 0, 1);
    query.date = { $gte: yearStart, $lt: yearEnd };
  }

  const enforcements = await Enforcement.find(query)
    .sort('-fineAmountUSD')
    .limit(parseInt(limit))
    .populate('regulation', 'name acronym')
    .lean();

  res.json({
    success: true,
    data: enforcements
  });
}));

// Get enforcements by authority
router.get('/by-authority/:authority', optionalAuth, asyncHandler(async (req, res) => {
  const { authority } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const query = { authority: new RegExp(authority, 'i') };

  const [enforcements, total, stats] = await Promise.all([
    Enforcement.find(query)
      .populate('regulation', 'name acronym')
      .sort('-date')
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Enforcement.countDocuments(query),
    Enforcement.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalFines: { $sum: '$fineAmountUSD' },
          avgFine: { $avg: '$fineAmountUSD' },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  res.json({
    success: true,
    data: enforcements,
    stats: stats[0] || { totalFines: 0, avgFine: 0, count: 0 },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// Get enforcement trends
router.get('/trends/data', optionalAuth, asyncHandler(async (req, res) => {
  const { years = 3 } = req.query;

  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - parseInt(years));

  const trends = await Enforcement.aggregate([
    { $match: { date: { $gte: startDate } } },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          quarter: { $ceil: { $divide: [{ $month: '$date' }, 3] } }
        },
        count: { $sum: 1 },
        totalFines: { $sum: '$fineAmountUSD' },
        avgFine: { $avg: '$fineAmountUSD' }
      }
    },
    { $sort: { '_id.year': 1, '_id.quarter': 1 } }
  ]);

  res.json({
    success: true,
    data: trends.map(t => ({
      period: `${t._id.year} Q${t._id.quarter}`,
      year: t._id.year,
      quarter: t._id.quarter,
      count: t.count,
      totalFines: Math.round(t.totalFines),
      avgFine: Math.round(t.avgFine)
    }))
  });
}));

// Search enforcements
router.get('/search/query', optionalAuth, asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;

  if (!q) {
    return res.json({ success: true, data: [], pagination: { total: 0 } });
  }

  const query = { $text: { $search: q } };
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [enforcements, total] = await Promise.all([
    Enforcement.find(query, { score: { $meta: 'textScore' } })
      .populate('regulation', 'name acronym')
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Enforcement.countDocuments(query)
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

export default router;
