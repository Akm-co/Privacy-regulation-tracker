import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { ScrapingJob, Update } from '../models/index.js';
import rssScraper from '../scrapers/parsers/rss.js';

async function testScrape() {
  await connectDB();
  console.log('Connected to MongoDB\n');

  // Test FPF job
  const fpfJob = await ScrapingJob.findOne({ sourceId: 'fpf' });
  console.log('FPF Job found:', !!fpfJob);
  console.log('  Type:', fpfJob?.type);
  console.log('  config.rssUrl:', fpfJob?.config?.rssUrl);
  console.log('  region:', fpfJob?.region);

  if (fpfJob) {
    console.log('\n--- Fetching RSS items ---');
    try {
      const items = await rssScraper.fetch(fpfJob);
      console.log(`\nFound ${items.length} items`);

      if (items.length > 0) {
        console.log('\nSample items:');
        items.slice(0, 3).forEach((item, i) => {
          console.log(`\n${i + 1}. ${item.title}`);
          console.log(`   URL: ${item.sourceUrl}`);
          console.log(`   Date: ${item.publicationDate}`);
          console.log(`   Region: ${item.regions?.[0]?.code}`);
        });

        // Check if any exist in DB
        console.log('\n--- Checking for duplicates ---');
        for (const item of items.slice(0, 3)) {
          const exists = await Update.findOne({ sourceUrl: item.sourceUrl });
          console.log(`  ${item.title.slice(0, 40)}... : ${exists ? 'EXISTS' : 'NEW'}`);
        }

        // Try saving one item
        console.log('\n--- Attempting to save first item ---');
        const testItem = items[0];
        try {
          const update = await Update.create({
            ...testItem,
            sourceId: fpfJob.sourceId,
            sourceName: fpfJob.sourceName,
            sourceTier: fpfJob.tier,
            scrapedAt: new Date()
          });
          console.log('Saved update:', update._id);
        } catch (err) {
          console.log('Save error:', err.message);
        }
      }
    } catch (error) {
      console.log('Fetch error:', error.message);
    }
  }

  process.exit(0);
}

testScrape();
