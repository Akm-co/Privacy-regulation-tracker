import { Router } from 'express';
import { Update, User } from '../models/index.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';
import { cache } from '../config/redis.js';

const router = Router();

// Get all updates (feed)
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    region,
    regulation,
    type,
    impact,
    tier,
    search,
    startDate,
    endDate,
    sort = '-publicationDate'
  } = req.query;

  // Build query
  const query = {};

  if (region) {
    query['regions.code'] = { $in: region.split(',') };
  }

  if (regulation) {
    query.regulations = regulation;
  }

  if (type) {
    query.updateType = { $in: type.split(',') };
  }

  if (impact) {
    query.impactLevel = { $in: impact.split(',') };
  }

  if (tier) {
    query.sourceTier = parseInt(tier);
  }

  if (startDate || endDate) {
    query.publicationDate = {};
    if (startDate) query.publicationDate.$gte = new Date(startDate);
    if (endDate) query.publicationDate.$lte = new Date(endDate);
  }

  if (search) {
    query.$text = { $search: search };
  }

  // Execute query
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [updates, total] = await Promise.all([
    Update.find(query)
      .populate('regulations', 'name acronym')
      .select('-content')
      .sort(sort)
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

// Get single update
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const update = await Update.findById(id)
    .populate('regulations', 'name acronym fullName jurisdiction')
    .populate('relatedUpdates', 'title sourceUrl publicationDate');

  if (!update) {
    throw new NotFoundError('Update');
  }

  // Increment view count
  await Update.findByIdAndUpdate(id, {
    $inc: { 'engagement.viewCount': 1 }
  });

  // Track view in user's history if authenticated
  if (req.user) {
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        recentlyViewed: {
          $each: [{ itemType: 'update', itemId: id, viewedAt: new Date() }],
          $slice: -50
        }
      }
    });
  }

  res.json({
    success: true,
    data: update
  });
}));

// Get update statistics
router.get('/stats/summary', optionalAuth, asyncHandler(async (req, res) => {
  const cacheKey = 'updates:stats';
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    todayCount,
    weekCount,
    monthCount,
    byType,
    byImpact,
    byRegion
  ] = await Promise.all([
    Update.countDocuments({ publicationDate: { $gte: today } }),
    Update.countDocuments({ publicationDate: { $gte: weekAgo } }),
    Update.countDocuments({ publicationDate: { $gte: monthAgo } }),
    Update.aggregate([
      { $match: { publicationDate: { $gte: monthAgo } } },
      { $group: { _id: '$updateType', count: { $sum: 1 } } }
    ]),
    Update.aggregate([
      { $match: { publicationDate: { $gte: monthAgo } } },
      { $group: { _id: '$impactLevel', count: { $sum: 1 } } }
    ]),
    Update.aggregate([
      { $match: { publicationDate: { $gte: monthAgo } } },
      { $unwind: '$regions' },
      { $group: { _id: '$regions.code', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  ]);

  const response = {
    success: true,
    data: {
      todayCount,
      weekCount,
      monthCount,
      byType: byType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byImpact: byImpact.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      topRegions: byRegion
    }
  };

  await cache.set(cacheKey, response, 300); // Cache for 5 minutes

  res.json(response);
}));

// Save update for user
router.post('/:id/save', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes, folder } = req.body;

  const update = await Update.findById(id);
  if (!update) {
    throw new NotFoundError('Update');
  }

  // Check if already saved
  const user = await User.findById(req.user._id);
  const alreadySaved = user.savedUpdates.some(
    s => s.update.toString() === id
  );

  if (alreadySaved) {
    // Update notes/folder
    await User.updateOne(
      { _id: req.user._id, 'savedUpdates.update': id },
      {
        $set: {
          'savedUpdates.$.notes': notes,
          'savedUpdates.$.folder': folder
        }
      }
    );
  } else {
    // Add to saved
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        savedUpdates: {
          update: id,
          notes,
          folder,
          savedAt: new Date()
        }
      }
    });

    // Increment save count
    await Update.findByIdAndUpdate(id, {
      $inc: { 'engagement.saveCount': 1 }
    });
  }

  res.json({
    success: true,
    message: 'Update saved'
  });
}));

// Unsave update
router.delete('/:id/save', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  await User.findByIdAndUpdate(req.user._id, {
    $pull: { savedUpdates: { update: id } }
  });

  await Update.findByIdAndUpdate(id, {
    $inc: { 'engagement.saveCount': -1 }
  });

  res.json({
    success: true,
    message: 'Update removed from saved'
  });
}));

// Get user's saved updates
router.get('/saved/list', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, folder } = req.query;

  const user = await User.findById(req.user._id)
    .populate({
      path: 'savedUpdates.update',
      select: 'title summary sourceUrl publicationDate updateType impactLevel regions'
    });

  let savedUpdates = user.savedUpdates;

  if (folder) {
    savedUpdates = savedUpdates.filter(s => s.folder === folder);
  }

  // Sort by saved date
  savedUpdates.sort((a, b) => b.savedAt - a.savedAt);

  // Paginate
  const start = (parseInt(page) - 1) * parseInt(limit);
  const paginated = savedUpdates.slice(start, start + parseInt(limit));

  res.json({
    success: true,
    data: paginated,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: savedUpdates.length,
      pages: Math.ceil(savedUpdates.length / parseInt(limit))
    }
  });
}));

// Get updates for user's watched regions/regulations
router.get('/personalized/feed', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const user = await User.findById(req.user._id);
  const { watchedRegions, watchedRegulations, alertKeywords } = user.preferences;

  const query = {
    $or: []
  };

  if (watchedRegions?.length) {
    query.$or.push({ 'regions.code': { $in: watchedRegions } });
  }

  if (watchedRegulations?.length) {
    query.$or.push({ regulations: { $in: watchedRegulations } });
  }

  if (alertKeywords?.length) {
    query.$or.push({
      $or: alertKeywords.map(kw => ({
        $text: { $search: kw }
      }))
    });
  }

  // If no preferences, return empty
  if (query.$or.length === 0) {
    return res.json({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 0 }
    });
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [updates, total] = await Promise.all([
    Update.find(query)
      .populate('regulations', 'name acronym')
      .select('-content')
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

// Get trending updates
router.get('/trending/list', optionalAuth, asyncHandler(async (req, res) => {
  const cacheKey = 'updates:trending';
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const updates = await Update.find({
    publicationDate: { $gte: weekAgo }
  })
    .sort('-engagement.viewCount -engagement.saveCount -publicationDate')
    .limit(10)
    .populate('regulations', 'name acronym')
    .select('title summary sourceUrl publicationDate updateType impactLevel regions engagement')
    .lean();

  const response = {
    success: true,
    data: updates
  };

  await cache.set(cacheKey, response, 600); // Cache for 10 minutes

  res.json(response);
}));

export default router;
