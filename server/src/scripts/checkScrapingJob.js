import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { ScrapingJob } from '../models/index.js';

async function checkJobs() {
  await connectDB();
  console.log('Connected to MongoDB');

  const fpfJob = await ScrapingJob.findOne({ sourceId: 'fpf' });
  console.log('\nFPF Job:');
  console.log('  sourceId:', fpfJob?.sourceId);
  console.log('  type:', fpfJob?.type);
  console.log('  config.rssUrl:', fpfJob?.config?.rssUrl);
  console.log('  config.parser:', fpfJob?.config?.parser);

  const dprJob = await ScrapingJob.findOne({ sourceId: 'dataprotectionreport' });
  console.log('\nData Protection Report Job:');
  console.log('  sourceId:', dprJob?.sourceId);
  console.log('  type:', dprJob?.type);
  console.log('  config.rssUrl:', dprJob?.config?.rssUrl);
  console.log('  config.parser:', dprJob?.config?.parser);

  // Count RSS type jobs with rssUrl
  const rssJobs = await ScrapingJob.find({ type: 'rss' });
  const withUrl = rssJobs.filter(j => j.config?.rssUrl);
  console.log(`\nRSS Jobs: ${rssJobs.length} total, ${withUrl.length} with rssUrl`);

  process.exit(0);
}

checkJobs();
