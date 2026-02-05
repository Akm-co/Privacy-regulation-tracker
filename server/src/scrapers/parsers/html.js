import * as cheerio from 'cheerio';
import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

const htmlScraper = {
  async fetch(job) {
    const { config, sourceUrl, region, sourceId } = job;
    const url = config.newsUrl || sourceUrl;

    if (!url) {
      throw new Error(`No URL configured for ${sourceId}`);
    }

    logger.debug(`Scraping HTML: ${url}`);

    try {
      // Use static scraping with axios (no Puppeteer)
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache'
        },
        timeout: 30000,
        maxRedirects: 5
      });

      const html = response.data;
      const items = parseHtml(html, config, region, url);
      logger.debug(`Parsed ${items.length} items from HTML: ${url}`);

      return items;
    } catch (error) {
      logger.error(`HTML scrape error for ${url}:`, error.message);
      throw error;
    }
  }
};

function parseHtml(html, config, region, baseUrl) {
  const $ = cheerio.load(html);
  const items = [];
  const selectors = config.selectors || {};

  // Default selectors for common patterns
  const newsListSelector = selectors.newsList || 'article, .news-item, .post, .entry';
  const titleSelector = selectors.title || 'h2 a, h3 a, .title a, .headline a';
  const dateSelector = selectors.date || 'time, .date, .published, .timestamp';
  const linkSelector = selectors.link || 'a[href]';
  const summarySelector = selectors.summary || 'p, .excerpt, .summary, .description';

  $(newsListSelector).each((index, element) => {
    try {
      const $el = $(element);

      // Extract title
      const $titleEl = $el.find(titleSelector).first();
      const title = $titleEl.text().trim() || $el.find('h2, h3, h4').first().text().trim();

      if (!title) return; // Skip items without title

      // Extract link
      let link = $titleEl.attr('href') || $el.find(linkSelector).first().attr('href');
      if (link && !link.startsWith('http')) {
        // Make relative URLs absolute
        try {
          const base = new URL(baseUrl || config.newsUrl || config.sourceUrl);
          link = new URL(link, base.origin).href;
        } catch (e) {
          // If URL parsing fails, skip this item
          return;
        }
      }

      if (!link) return; // Skip items without link

      // Extract date
      const dateText = $el.find(dateSelector).first().attr('datetime') ||
        $el.find(dateSelector).first().text().trim();
      const publicationDate = parseDate(dateText);

      // Extract summary
      const summary = $el.find(summarySelector).first().text().trim().substring(0, 500);

      // Filter by keywords if configured
      if (config.keywords?.length) {
        const text = `${title} ${summary}`.toLowerCase();
        const matches = config.keywords.some(kw => text.includes(kw.toLowerCase()));
        if (!matches) return;
      }

      items.push({
        title: cleanText(title),
        summary: cleanText(summary) || title,
        sourceUrl: link,
        publicationDate,
        regions: [{ code: region, name: getRegionName(region) }],
        updateType: determineUpdateType(title, summary),
        impactLevel: determineImpactLevel(title, summary),
        hash: crypto.createHash('md5').update(title + link).digest('hex')
      });
    } catch (error) {
      logger.debug(`Error parsing item: ${error.message}`);
    }
  });

  return items;
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

function parseDate(dateStr) {
  if (!dateStr) return new Date();

  // Try common date formats
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;

  // Try parsing relative dates
  const lowerDate = dateStr.toLowerCase();
  if (lowerDate.includes('today')) return new Date();
  if (lowerDate.includes('yesterday')) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }
  if (lowerDate.includes('ago')) {
    const match = lowerDate.match(/(\d+)\s*(hour|day|week|month)/);
    if (match) {
      const num = parseInt(match[1]);
      const unit = match[2];
      const d = new Date();
      switch (unit) {
        case 'hour': d.setHours(d.getHours() - num); break;
        case 'day': d.setDate(d.getDate() - num); break;
        case 'week': d.setDate(d.getDate() - num * 7); break;
        case 'month': d.setMonth(d.getMonth() - num); break;
      }
      return d;
    }
  }

  return new Date();
}

function determineUpdateType(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();

  if (text.includes('enforcement') || text.includes('fine') || text.includes('penalty') || text.includes('sanction')) {
    return 'enforcement';
  }
  if (text.includes('guidance') || text.includes('guideline') || text.includes('recommendation')) {
    return 'guidance';
  }
  if (text.includes('amendment') || text.includes('update') || text.includes('revision') || text.includes('change')) {
    return 'amendment';
  }
  if (text.includes('breach') || text.includes('incident') || text.includes('leak')) {
    return 'breach';
  }
  if (text.includes('rule') || text.includes('regulation') || text.includes('law')) {
    return 'rulemaking';
  }

  return 'news';
}

function determineImpactLevel(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();

  if (text.includes('major') || text.includes('significant') || text.includes('landmark') ||
      text.includes('million') || text.includes('billion') || text.includes('record')) {
    return 'high';
  }
  if (text.includes('urgent') || text.includes('critical') || text.includes('breaking') || text.includes('emergency')) {
    return 'critical';
  }
  if (text.includes('minor') || text.includes('clarification') || text.includes('technical')) {
    return 'low';
  }

  return 'medium';
}

function getRegionName(code) {
  const regionNames = {
    EU: 'European Union', US: 'United States', UK: 'United Kingdom',
    DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain',
    CA: 'Canada', AU: 'Australia', SG: 'Singapore', JP: 'Japan',
    CN: 'China', IN: 'India', BR: 'Brazil', ZA: 'South Africa'
  };
  return regionNames[code] || code;
}

export default htmlScraper;
