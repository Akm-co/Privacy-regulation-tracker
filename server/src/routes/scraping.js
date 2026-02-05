import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { ScrapingJob, Update } from '../models/index.js';
import { triggerScrape, triggerAllScrapes, getScrapingStatus, initializeScrapingJobs } from '../scrapers/scheduler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get scraping status
router.get('/status', async (req, res, next) => {
  try {
    const status = await getScrapingStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

// Get all scraping jobs
router.get('/jobs', async (req, res, next) => {
  try {
    const jobs = await ScrapingJob.find()
      .select('sourceId sourceName tier type region status lastRun nextRun stats enabled')
      .sort({ tier: 1, sourceName: 1 });

    res.json({ success: true, data: jobs });
  } catch (error) {
    next(error);
  }
});

// Trigger scrape for a specific source
router.post('/trigger/:sourceId', async (req, res, next) => {
  try {
    const { sourceId } = req.params;
    const result = await triggerScrape(sourceId);
    logger.info(`Manual scrape triggered for ${sourceId}`);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Trigger scrape for all sources in a tier
router.post('/trigger-tier/:tier', async (req, res, next) => {
  try {
    const tier = parseInt(req.params.tier);
    const jobs = await ScrapingJob.find({ tier, enabled: true });

    const results = [];
    for (const job of jobs) {
      try {
        const result = await triggerScrape(job.sourceId);
        results.push({ sourceId: job.sourceId, success: true });
      } catch (error) {
        results.push({ sourceId: job.sourceId, success: false, error: error.message });
      }
    }

    logger.info(`Manual scrape triggered for tier ${tier}: ${results.length} sources`);
    res.json({ success: true, data: { tier, results } });
  } catch (error) {
    next(error);
  }
});

// Trigger scrape for all sources (direct execution)
router.post('/trigger-all', async (req, res, next) => {
  try {
    const { limit = 20, type = null, tier = null } = req.body;

    logger.info('Manual trigger-all scrape requested');

    // Execute scrapes directly (works without Redis)
    const result = await triggerAllScrapes({ limit, type, tier });

    logger.info(`Manual scrape complete: ${result.completed} succeeded, ${result.failed} failed, ${result.totalNew} new items`);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Initialize/reinitialize scraping jobs
router.post('/initialize', async (req, res, next) => {
  try {
    await initializeScrapingJobs();
    const jobs = await ScrapingJob.countDocuments();
    logger.info(`Scraping jobs initialized: ${jobs} sources`);
    res.json({ success: true, data: { jobsCount: jobs } });
  } catch (error) {
    next(error);
  }
});

// Enable/disable a scraping job
router.patch('/jobs/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { enabled } = req.body;

    const job = await ScrapingJob.findByIdAndUpdate(
      jobId,
      { enabled },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    res.json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
});

// Get scraping statistics
router.get('/stats', async (req, res, next) => {
  try {
    const [
      totalJobs,
      enabledJobs,
      recentUpdates,
      jobsByTier,
      jobsByStatus
    ] = await Promise.all([
      ScrapingJob.countDocuments(),
      ScrapingJob.countDocuments({ enabled: true }),
      Update.countDocuments({
        scrapedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),
      ScrapingJob.aggregate([
        { $group: { _id: '$tier', count: { $sum: 1 } } }
      ]),
      ScrapingJob.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalJobs,
        enabledJobs,
        recentUpdates,
        byTier: Object.fromEntries(jobsByTier.map(t => [t._id, t.count])),
        byStatus: Object.fromEntries(jobsByStatus.map(s => [s._id, s.count]))
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
