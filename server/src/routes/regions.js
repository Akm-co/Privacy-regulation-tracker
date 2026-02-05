import { Router } from 'express';
import { Regulation, Update, Enforcement } from '../models/index.js';
import { optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { cache } from '../config/redis.js';

const router = Router();

// Region metadata
const regionMetadata = {
  // Supranational
  EU: { name: 'European Union', type: 'supranational', lat: 50.85, lng: 4.35 },

  // Europe
  AT: { name: 'Austria', type: 'national', lat: 47.52, lng: 14.55 },
  BE: { name: 'Belgium', type: 'national', lat: 50.50, lng: 4.47 },
  BG: { name: 'Bulgaria', type: 'national', lat: 42.73, lng: 25.49 },
  HR: { name: 'Croatia', type: 'national', lat: 45.10, lng: 15.20 },
  CY: { name: 'Cyprus', type: 'national', lat: 35.13, lng: 33.43 },
  CZ: { name: 'Czech Republic', type: 'national', lat: 49.82, lng: 15.47 },
  DK: { name: 'Denmark', type: 'national', lat: 56.26, lng: 9.50 },
  EE: { name: 'Estonia', type: 'national', lat: 58.60, lng: 25.01 },
  FI: { name: 'Finland', type: 'national', lat: 61.92, lng: 25.75 },
  FR: { name: 'France', type: 'national', lat: 46.23, lng: 2.21 },
  DE: { name: 'Germany', type: 'national', lat: 51.17, lng: 10.45 },
  GR: { name: 'Greece', type: 'national', lat: 39.07, lng: 21.82 },
  HU: { name: 'Hungary', type: 'national', lat: 47.16, lng: 19.50 },
  IE: { name: 'Ireland', type: 'national', lat: 53.14, lng: -7.69 },
  IT: { name: 'Italy', type: 'national', lat: 41.87, lng: 12.57 },
  LV: { name: 'Latvia', type: 'national', lat: 56.88, lng: 24.60 },
  LT: { name: 'Lithuania', type: 'national', lat: 55.17, lng: 23.88 },
  LU: { name: 'Luxembourg', type: 'national', lat: 49.82, lng: 6.13 },
  MT: { name: 'Malta', type: 'national', lat: 35.94, lng: 14.38 },
  NL: { name: 'Netherlands', type: 'national', lat: 52.13, lng: 5.29 },
  PL: { name: 'Poland', type: 'national', lat: 51.92, lng: 19.15 },
  PT: { name: 'Portugal', type: 'national', lat: 39.40, lng: -8.22 },
  RO: { name: 'Romania', type: 'national', lat: 45.94, lng: 24.97 },
  SK: { name: 'Slovakia', type: 'national', lat: 48.67, lng: 19.70 },
  SI: { name: 'Slovenia', type: 'national', lat: 46.15, lng: 14.99 },
  ES: { name: 'Spain', type: 'national', lat: 40.46, lng: -3.75 },
  SE: { name: 'Sweden', type: 'national', lat: 60.13, lng: 18.64 },
  UK: { name: 'United Kingdom', type: 'national', lat: 55.38, lng: -3.44 },
  CH: { name: 'Switzerland', type: 'national', lat: 46.82, lng: 8.23 },
  NO: { name: 'Norway', type: 'national', lat: 60.47, lng: 8.47 },
  IS: { name: 'Iceland', type: 'national', lat: 64.96, lng: -19.02 },

  // Americas
  US: { name: 'United States', type: 'national', lat: 37.09, lng: -95.71 },
  'US-CA': { name: 'California', type: 'state', parent: 'US', lat: 36.78, lng: -119.42 },
  'US-CO': { name: 'Colorado', type: 'state', parent: 'US', lat: 39.55, lng: -105.78 },
  'US-CT': { name: 'Connecticut', type: 'state', parent: 'US', lat: 41.60, lng: -72.76 },
  'US-VA': { name: 'Virginia', type: 'state', parent: 'US', lat: 37.43, lng: -78.66 },
  'US-UT': { name: 'Utah', type: 'state', parent: 'US', lat: 39.32, lng: -111.09 },
  'US-TX': { name: 'Texas', type: 'state', parent: 'US', lat: 31.97, lng: -99.90 },
  'US-OR': { name: 'Oregon', type: 'state', parent: 'US', lat: 43.80, lng: -120.55 },
  CA: { name: 'Canada', type: 'national', lat: 56.13, lng: -106.35 },
  'CA-QC': { name: 'Quebec', type: 'province', parent: 'CA', lat: 52.94, lng: -73.55 },
  BR: { name: 'Brazil', type: 'national', lat: -14.24, lng: -51.93 },
  AR: { name: 'Argentina', type: 'national', lat: -38.42, lng: -63.62 },
  MX: { name: 'Mexico', type: 'national', lat: 23.63, lng: -102.55 },

  // Asia Pacific
  CN: { name: 'China', type: 'national', lat: 35.86, lng: 104.20 },
  JP: { name: 'Japan', type: 'national', lat: 36.20, lng: 138.25 },
  KR: { name: 'South Korea', type: 'national', lat: 35.91, lng: 127.77 },
  IN: { name: 'India', type: 'national', lat: 20.59, lng: 78.96 },
  SG: { name: 'Singapore', type: 'national', lat: 1.35, lng: 103.82 },
  AU: { name: 'Australia', type: 'national', lat: -25.27, lng: 133.78 },
  NZ: { name: 'New Zealand', type: 'national', lat: -40.90, lng: 174.89 },
  TH: { name: 'Thailand', type: 'national', lat: 15.87, lng: 100.99 },
  ID: { name: 'Indonesia', type: 'national', lat: -0.79, lng: 113.92 },
  MY: { name: 'Malaysia', type: 'national', lat: 4.21, lng: 101.98 },
  PH: { name: 'Philippines', type: 'national', lat: 12.88, lng: 121.77 },
  VN: { name: 'Vietnam', type: 'national', lat: 14.06, lng: 108.28 },

  // Middle East & Africa
  AE: { name: 'United Arab Emirates', type: 'national', lat: 23.42, lng: 53.85 },
  SA: { name: 'Saudi Arabia', type: 'national', lat: 23.89, lng: 45.08 },
  BH: { name: 'Bahrain', type: 'national', lat: 26.07, lng: 50.56 },
  IL: { name: 'Israel', type: 'national', lat: 31.05, lng: 34.85 },
  ZA: { name: 'South Africa', type: 'national', lat: -30.56, lng: 22.94 },
  KE: { name: 'Kenya', type: 'national', lat: -0.02, lng: 37.91 },
  NG: { name: 'Nigeria', type: 'national', lat: 9.08, lng: 8.68 },
  EG: { name: 'Egypt', type: 'national', lat: 26.82, lng: 30.80 }
};

// Get all regions with metadata
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const cacheKey = 'regions:all';
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  // Get regulation counts by country code
  const countryCounts = await Regulation.aggregate([
    { $match: { status: 'active' } },
    { $unwind: '$jurisdiction.countries' },
    { $group: { _id: '$jurisdiction.countries.code', count: { $sum: 1 } } }
  ]);

  // Get regulation counts for EU supranational
  const euCount = await Regulation.countDocuments({ status: 'active', 'jurisdiction.region': 'EU' });

  // Combine
  const regulationCounts = [...countryCounts, { _id: 'EU', count: euCount }];

  // Get update counts by region (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const updateCounts = await Update.aggregate([
    { $match: { publicationDate: { $gte: thirtyDaysAgo } } },
    { $unwind: '$regions' },
    { $group: { _id: '$regions.code', count: { $sum: 1 } } }
  ]);

  // Build response
  const regions = Object.entries(regionMetadata).map(([code, meta]) => {
    const regCount = regulationCounts.find(r => r._id === code);
    const updateCount = updateCounts.find(u => u._id === code);

    return {
      code,
      ...meta,
      regulationCount: regCount?.count || 0,
      recentUpdateCount: updateCount?.count || 0,
      hasActivity: (updateCount?.count || 0) > 0
    };
  });

  const response = {
    success: true,
    data: regions
  };

  await cache.set(cacheKey, response, 600); // Cache for 10 minutes

  res.json(response);
}));

// Get single region details
router.get('/:code', optionalAuth, asyncHandler(async (req, res) => {
  const { code } = req.params;
  const meta = regionMetadata[code.toUpperCase()];

  if (!meta) {
    return res.status(404).json({
      success: false,
      error: 'Region not found'
    });
  }

  const cacheKey = `region:${code}`;
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  const [regulations, recentUpdates, enforcements, stats] = await Promise.all([
    // Regulations
    Regulation.find({
      $or: [
        { 'jurisdiction.region': code.toUpperCase() },
        { 'jurisdiction.countries.code': code.toUpperCase() }
      ],
      status: 'active'
    }).select('name acronym fullName effectiveDate strictnessScore tags'),

    // Recent updates
    Update.find({
      'regions.code': code.toUpperCase()
    })
      .sort('-publicationDate')
      .limit(10)
      .select('title summary publicationDate updateType impactLevel'),

    // Recent enforcements
    Enforcement.find({ country: code.toUpperCase() })
      .sort('-date')
      .limit(5)
      .select('company fineAmountUSD date summary'),

    // Stats
    Promise.all([
      Update.countDocuments({ 'regions.code': code.toUpperCase() }),
      Enforcement.aggregate([
        { $match: { country: code.toUpperCase() } },
        { $group: { _id: null, total: { $sum: '$fineAmountUSD' }, count: { $sum: 1 } } }
      ])
    ])
  ]);

  const response = {
    success: true,
    data: {
      code: code.toUpperCase(),
      ...meta,
      regulations,
      recentUpdates,
      recentEnforcements: enforcements,
      stats: {
        totalUpdates: stats[0],
        totalEnforcements: stats[1][0]?.count || 0,
        totalFinesUSD: stats[1][0]?.total || 0
      }
    }
  };

  await cache.set(cacheKey, response, 300); // Cache for 5 minutes

  res.json(response);
}));

// Get regulations for a region
router.get('/:code/regulations', optionalAuth, asyncHandler(async (req, res) => {
  const { code } = req.params;

  const regulations = await Regulation.find({
    $or: [
      { 'jurisdiction.region': code.toUpperCase() },
      { 'jurisdiction.countries.code': code.toUpperCase() }
    ]
  })
    .select('name acronym fullName status effectiveDate strictnessScore summary tags')
    .sort('-effectiveDate');

  res.json({
    success: true,
    data: regulations
  });
}));

// Get updates for a region
router.get('/:code/updates', optionalAuth, asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [updates, total] = await Promise.all([
    Update.find({ 'regions.code': code.toUpperCase() })
      .sort('-publicationDate')
      .skip(skip)
      .limit(parseInt(limit))
      .select('title summary publicationDate updateType impactLevel sourceUrl')
      .lean(),
    Update.countDocuments({ 'regions.code': code.toUpperCase() })
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

// Map GB to UK and vice versa for compatibility
const codeAliases = { 'GB': 'UK', 'UK': 'GB' };

// Get map data (GeoJSON + overlay)
router.get('/map/data', optionalAuth, asyncHandler(async (req, res) => {
  const cacheKey = 'map:data';
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  // Get strictness scores by country code
  const countryStrictness = await Regulation.aggregate([
    { $match: { status: 'active' } },
    { $unwind: '$jurisdiction.countries' },
    {
      $group: {
        _id: '$jurisdiction.countries.code',
        maxStrictness: { $max: '$strictnessScore' },
        avgStrictness: { $avg: '$strictnessScore' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Get strictness scores by supranational region (EU, etc.)
  const regionStrictness = await Regulation.aggregate([
    { $match: { status: 'active', 'jurisdiction.region': 'EU' } },
    {
      $group: {
        _id: 'EU',
        maxStrictness: { $max: '$strictnessScore' },
        avgStrictness: { $avg: '$strictnessScore' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Combine both and handle GB/UK alias
  const strictnessScores = [...countryStrictness, ...regionStrictness];

  // Create lookup with aliases (GB data should also be available as UK)
  const strictnessLookup = {};
  strictnessScores.forEach(s => {
    strictnessLookup[s._id] = s;
    if (codeAliases[s._id]) {
      strictnessLookup[codeAliases[s._id]] = s;
    }
  });

  // Get recent activity
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentActivity = await Update.aggregate([
    { $match: { publicationDate: { $gte: weekAgo } } },
    { $unwind: '$regions' },
    {
      $group: {
        _id: '$regions.code',
        updateCount: { $sum: 1 },
        highImpactCount: {
          $sum: { $cond: [{ $in: ['$impactLevel', ['high', 'critical']] }, 1, 0] }
        }
      }
    }
  ]);

  // Create activity lookup with aliases
  const activityLookup = {};
  recentActivity.forEach(a => {
    activityLookup[a._id] = a;
    if (codeAliases[a._id]) {
      activityLookup[codeAliases[a._id]] = a;
    }
  });

  // Build map features
  const features = Object.entries(regionMetadata).map(([code, meta]) => {
    const strictness = strictnessLookup[code];
    const activity = activityLookup[code];

    return {
      type: 'Feature',
      properties: {
        code,
        name: meta.name,
        type: meta.type,
        strictnessScore: strictness?.maxStrictness || 0,
        avgStrictness: strictness?.avgStrictness || 0,
        regulationCount: strictness?.count || 0,
        recentUpdates: activity?.updateCount || 0,
        highImpactUpdates: activity?.highImpactCount || 0,
        hasRecentActivity: (activity?.updateCount || 0) > 0
      },
      geometry: {
        type: 'Point',
        coordinates: [meta.lng, meta.lat]
      }
    };
  });

  const response = {
    success: true,
    data: {
      type: 'FeatureCollection',
      features
    }
  };

  await cache.set(cacheKey, response, 300); // Cache for 5 minutes

  res.json(response);
}));

// Get region activity heatmap data
router.get('/heatmap/data', optionalAuth, asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;

  const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

  const activity = await Update.aggregate([
    { $match: { publicationDate: { $gte: startDate } } },
    { $unwind: '$regions' },
    {
      $group: {
        _id: '$regions.code',
        count: { $sum: 1 },
        impactScore: {
          $sum: {
            $switch: {
              branches: [
                { case: { $eq: ['$impactLevel', 'critical'] }, then: 4 },
                { case: { $eq: ['$impactLevel', 'high'] }, then: 3 },
                { case: { $eq: ['$impactLevel', 'medium'] }, then: 2 },
                { case: { $eq: ['$impactLevel', 'low'] }, then: 1 }
              ],
              default: 1
            }
          }
        }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const heatmapData = activity.map(a => {
    const meta = regionMetadata[a._id];
    if (!meta) return null;

    return {
      code: a._id,
      name: meta.name,
      lat: meta.lat,
      lng: meta.lng,
      weight: a.impactScore,
      count: a.count
    };
  }).filter(Boolean);

  res.json({
    success: true,
    data: heatmapData
  });
}));

export default router;
