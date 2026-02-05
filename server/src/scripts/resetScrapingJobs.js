import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { ScrapingJob } from '../models/index.js';
import { getAllEnabledSources } from '../scrapers/sources/sources.config.js';

const resetScrapingJobs = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Delete all existing scraping jobs
    const deleted = await ScrapingJob.deleteMany({});
    console.log(`Deleted ${deleted.deletedCount} existing scraping jobs`);

    // Get all enabled sources from config
    const sources = getAllEnabledSources();
    console.log(`Reinitializing ${sources.length} scraping sources...`);

    for (const source of sources) {
      const job = new ScrapingJob({
        source: source.name,
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.url,
        tier: source.id.includes('tier1') ? 1 : source.id.includes('tier2') ? 2 : source.rssUrl ? 1 : 2,
        type: source.type,
        region: source.region,
        schedule: source.frequency,
        config: {
          parser: source.parser,
          selectors: source.selectors,
          keywords: source.keywords,
          rssUrl: source.rssUrl,
          apiUrl: source.apiUrl,
          newsUrl: source.newsUrl
        },
        enabled: source.enabled
      });

      job.calculateNextRun();
      await job.save();
      console.log(`  Created: ${source.name} (${source.type})`);
    }

    console.log(`\nSuccessfully initialized ${sources.length} scraping jobs`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

resetScrapingJobs();
