import cron from 'node-cron';
import { Queue, Worker } from 'bullmq';
import { ScrapingJob, Update } from '../models/index.js';
import { getAllEnabledSources, getSourcesByTier } from './sources/sources.config.js';
import { logger } from '../utils/logger.js';
import { broadcastUpdate } from '../websocket/index.js';

// Queue configuration
const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined
};

let scrapingQueue = null;
let scrapingWorker = null;
let redisAvailable = false;

// Initialize scraping jobs from config
export const initializeScrapingJobs = async () => {
  const sources = getAllEnabledSources();
  logger.info(`Initializing ${sources.length} scraping sources`);

  for (const source of sources) {
    try {
      let job = await ScrapingJob.findOne({ sourceId: source.id });

      if (!job) {
        job = new ScrapingJob({
          source: source.name,
          sourceId: source.id,
          sourceName: source.name,
          sourceUrl: source.url,
          tier: parseInt(source.id.startsWith('tier1') ? 1 : source.id.startsWith('tier2') ? 2 : 3) ||
            (source.rssUrl ? 1 : 2),
          type: source.type,
          region: source.region,
          schedule: source.frequency,
          config: {
            parser: source.parser,
            selectors: source.selectors,
            keywords: source.keywords,
            rssUrl: source.rssUrl,
            apiUrl: source.apiUrl
          },
          enabled: source.enabled
        });

        job.calculateNextRun();
        await job.save();
        logger.debug(`Created scraping job for ${source.name}`);
      }
    } catch (error) {
      logger.error(`Failed to initialize job for ${source.name}:`, error);
    }
  }

  // Setup job queue and workers (optional - works without Redis)
  await setupScrapingQueue();

  // Start scheduler
  startScheduler();

  // Run initial scrape for key sources on startup
  if (process.env.SCRAPE_ON_STARTUP !== 'false') {
    logger.info('Running initial scrape on startup...');
    // Run in background without blocking startup
    runInitialScrape().catch(err => {
      logger.error('Initial scrape failed:', err.message);
    });
  }
};

// Setup BullMQ queue (optional - scraping works without Redis)
const setupScrapingQueue = async () => {
  try {
    scrapingQueue = new Queue('scraping', {
      connection: REDIS_CONNECTION,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: 100,
        removeOnFail: 50
      }
    });

    scrapingWorker = new Worker('scraping', processScrapingJob, {
      connection: REDIS_CONNECTION,
      concurrency: 5, // Process 5 jobs concurrently
      limiter: {
        max: 10,
        duration: 1000 // 10 jobs per second max
      }
    });

    scrapingWorker.on('completed', (job, result) => {
      logger.info(`Scraping job completed: ${job.data.sourceId} - ${result.itemsNew} new items`);
    });

    scrapingWorker.on('failed', (job, err) => {
      logger.error(`Scraping job failed: ${job?.data?.sourceId} - ${err.message}`);
    });

    redisAvailable = true;
    logger.info('Scraping queue initialized with Redis');
  } catch (error) {
    redisAvailable = false;
    logger.warn('Redis not available, scraping will run without queue:', error.message);
    logger.info('Scraping will use direct execution mode');
  }
};

// Run initial scrape for key sources on startup
const runInitialScrape = async () => {
  // Priority sources to fetch on startup (mix of RSS and HTML scraping)
  const prioritySources = [
    'ico-uk',              // UK ICO (RSS)
    'federal-register',    // US Federal Register (API - reliable)
    'dataprotectionreport', // Data Protection Report (WordPress RSS - reliable)
    'fpf',                 // Future of Privacy Forum (WordPress RSS)
    'lexology',            // Legal news (RSS)
    'cnil-france',         // French CNIL (HTML scrape)
    'ftc',                 // US FTC (HTML scrape)
    'edpb',                // EU Data Protection Board (HTML scrape)
  ];

  logger.info('Starting initial scrape for priority sources...');

  const jobs = await ScrapingJob.find({
    sourceId: { $in: prioritySources },
    enabled: true
  });

  let totalNew = 0;
  let totalFailed = 0;

  for (const job of jobs) {
    try {
      logger.info(`Initial scrape: ${job.sourceName} (${job.type})`);
      const result = await executeScrapeDirectly(job);
      totalNew += result.new;
      logger.info(`  → Found ${result.found} items, ${result.new} new`);
    } catch (error) {
      totalFailed++;
      logger.error(`  → Failed: ${error.message}`);
    }

    // Small delay between sources to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  logger.info(`Initial scrape complete: ${totalNew} new items, ${totalFailed} failures`);
  return { totalNew, totalFailed };
};

// Execute scrape directly without queue (for initial scrape or when Redis unavailable)
const executeScrapeDirectly = async (job) => {
  const startTime = new Date();

  try {
    const results = await executeScrape(job);

    // Record successful run
    job.recordRun({
      startTime,
      status: 'success',
      itemsFound: results.found,
      itemsNew: results.new,
      itemsUpdated: results.updated,
      itemsSkipped: results.skipped
    });

    job.status = 'idle';
    job.calculateNextRun();
    await job.save();

    return results;
  } catch (error) {
    // Record failed run
    job.recordRun({
      startTime,
      status: 'failed',
      errors: [{ message: error.message, stack: error.stack, timestamp: new Date() }]
    });

    job.status = 'failed';
    job.calculateNextRun();
    await job.save();

    throw error;
  }
};

// Process individual scraping job
const processScrapingJob = async (job) => {
  const { sourceId, jobId } = job.data;

  const scrapingJobDoc = await ScrapingJob.findById(jobId);
  if (!scrapingJobDoc) {
    throw new Error(`Scraping job not found: ${jobId}`);
  }

  const startTime = new Date();
  scrapingJobDoc.status = 'running';
  await scrapingJobDoc.save();

  try {
    const results = await executeScrape(scrapingJobDoc);

    // Record successful run
    scrapingJobDoc.recordRun({
      startTime,
      status: 'success',
      itemsFound: results.found,
      itemsNew: results.new,
      itemsUpdated: results.updated,
      itemsSkipped: results.skipped
    });

    scrapingJobDoc.status = 'idle';
    scrapingJobDoc.calculateNextRun();
    await scrapingJobDoc.save();

    return results;
  } catch (error) {
    // Record failed run
    scrapingJobDoc.recordRun({
      startTime,
      status: 'failed',
      errors: [{ message: error.message, stack: error.stack, timestamp: new Date() }]
    });

    scrapingJobDoc.status = 'failed';
    scrapingJobDoc.calculateNextRun();
    await scrapingJobDoc.save();

    throw error;
  }
};

// Execute the actual scrape
const executeScrape = async (job) => {
  const { type, config } = job;
  let scraper;

  switch (type) {
    case 'rss':
      scraper = (await import('./parsers/rss.js')).default;
      break;
    case 'api':
      scraper = (await import('./parsers/api.js')).default;
      break;
    case 'scrape':
      scraper = (await import('./parsers/html.js')).default;
      break;
    default:
      throw new Error(`Unknown scraper type: ${type}`);
  }

  const rawItems = await scraper.fetch(job);
  const results = {
    found: rawItems.length,
    new: 0,
    updated: 0,
    skipped: 0
  };

  for (const item of rawItems) {
    try {
      // Check for duplicates
      const existing = await Update.findOne({ sourceUrl: item.sourceUrl });

      if (existing) {
        // Check if content changed (for updates)
        if (item.hash && existing.hash !== item.hash) {
          await Update.findByIdAndUpdate(existing._id, {
            ...item,
            scrapedAt: new Date()
          });
          results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        // Create new update
        const update = await Update.create({
          ...item,
          sourceId: job.sourceId,
          sourceName: job.sourceName,
          sourceTier: job.tier,
          scrapedAt: new Date()
        });

        results.new++;

        // Broadcast new update via WebSocket (if io is available)
        const app = global.app;
        if (app) {
          const io = app.get('io');
          if (io) {
            broadcastUpdate(io, update);
          }
        }
      }
    } catch (error) {
      logger.error(`Error processing item from ${job.sourceId}:`, error);
      results.skipped++;
    }
  }

  return results;
};

// Start the scheduler
const startScheduler = () => {
  // Check for due jobs every minute
  cron.schedule('* * * * *', async () => {
    try {
      const dueJobs = await ScrapingJob.getDueJobs();

      for (const job of dueJobs) {
        if (scrapingQueue) {
          await scrapingQueue.add(job.sourceId, {
            sourceId: job.sourceId,
            jobId: job._id.toString()
          }, {
            priority: 10 - job.priority // Higher priority = lower number in Bull
          });

          logger.debug(`Queued scraping job: ${job.sourceId}`);
        }
      }
    } catch (error) {
      logger.error('Scheduler error:', error);
    }
  });

  // Health check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const summary = await ScrapingJob.getHealthSummary();
      logger.info(`Scraping health: ${summary.healthy}/${summary.total} healthy (${summary.healthPercentage}%)`);

      if (summary.failing > 0) {
        logger.warn(`${summary.failing} sources have consecutive failures`);
      }
    } catch (error) {
      logger.error('Health check error:', error);
    }
  });

  logger.info('Scraping scheduler started');
};

// Manual trigger for a specific source
export const triggerScrape = async (sourceId) => {
  const job = await ScrapingJob.findOne({ sourceId });

  if (!job) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  // If Redis is available, use the queue
  if (redisAvailable && scrapingQueue) {
    await scrapingQueue.add(sourceId, {
      sourceId: job.sourceId,
      jobId: job._id.toString()
    }, {
      priority: 1 // High priority for manual triggers
    });
    return { message: `Scrape queued for ${sourceId}` };
  }

  // Otherwise run directly
  const result = await executeScrapeDirectly(job);
  return {
    message: `Scrape completed for ${sourceId}`,
    found: result.found,
    new: result.new
  };
};

// Trigger all enabled sources (direct execution, no queue)
export const triggerAllScrapes = async (options = {}) => {
  const { limit = 20, type = null, tier = null } = options;

  let query = { enabled: true };

  if (type) {
    query.type = type;
  }

  if (tier) {
    query.tier = tier;
  }

  const jobs = await ScrapingJob.find(query)
    .sort({ tier: 1 }) // Tier 1 first (official sources)
    .limit(limit);

  logger.info(`Triggering scrape for ${jobs.length} sources...`);

  const results = {
    triggered: jobs.length,
    completed: 0,
    failed: 0,
    totalNew: 0,
    errors: []
  };

  for (const job of jobs) {
    try {
      logger.info(`Scraping: ${job.sourceName}`);
      const result = await executeScrapeDirectly(job);
      results.completed++;
      results.totalNew += result.new;
      logger.info(`  → ${result.found} found, ${result.new} new`);
    } catch (error) {
      results.failed++;
      results.errors.push({ sourceId: job.sourceId, error: error.message });
      logger.error(`  → Failed: ${error.message}`);
    }

    // Small delay between sources
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  logger.info(`Scrape complete: ${results.completed} succeeded, ${results.failed} failed, ${results.totalNew} new items`);
  return results;
};

// Get scraping status
export const getScrapingStatus = async () => {
  const [jobs, queueStats] = await Promise.all([
    ScrapingJob.find().select('sourceId sourceName status lastRun nextRun stats'),
    scrapingQueue ? {
      waiting: await scrapingQueue.getWaitingCount(),
      active: await scrapingQueue.getActiveCount(),
      completed: await scrapingQueue.getCompletedCount(),
      failed: await scrapingQueue.getFailedCount()
    } : null
  ]);

  return {
    jobs,
    queue: queueStats,
    health: await ScrapingJob.getHealthSummary()
  };
};

// Cleanup
export const shutdownScraper = async () => {
  if (scrapingWorker) {
    await scrapingWorker.close();
  }
  if (scrapingQueue) {
    await scrapingQueue.close();
  }
  logger.info('Scraper shutdown complete');
};
