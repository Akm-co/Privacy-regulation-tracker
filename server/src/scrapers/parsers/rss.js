import Parser from 'rss-parser';
import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': process.env.SCRAPING_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  customFields: {
    item: [
      ['dc:creator', 'creator'],
      ['dc:date', 'dcDate'],
      ['content:encoded', 'contentEncoded'],
      ['media:content', 'mediaContent']
    ]
  }
});

// Create a lenient parser with XML entity fixing
const lenientParser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  customFields: {
    item: [
      ['dc:creator', 'creator'],
      ['dc:date', 'dcDate'],
      ['content:encoded', 'contentEncoded']
    ]
  },
  xml2jsOptions: {
    strict: false,  // Allow non-strict XML parsing
    normalizeTags: true,
    normalize: true
  }
});

const rssScraper = {
  async fetch(job) {
    const { config, region, sourceId } = job;
    const rssUrl = config.rssUrl || job.sourceUrl;

    if (!rssUrl) {
      throw new Error(`No RSS URL configured for ${sourceId}`);
    }

    logger.debug(`Fetching RSS: ${rssUrl}`);

    try {
      let feed;

      // Try standard parser first
      try {
        feed = await parser.parseURL(rssUrl);
      } catch (parseError) {
        logger.debug(`Standard parser failed for ${rssUrl}, trying lenient parser...`);

        // Try fetching raw content and cleaning it first
        try {
          const response = await axios.get(rssUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            },
            timeout: 30000
          });

          // Clean the XML content
          let xmlContent = response.data;
          if (typeof xmlContent === 'string') {
            // Fix common XML issues
            xmlContent = xmlContent
              .replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;')  // Fix unescaped ampersands
              .replace(/<!--[\s\S]*?-->/g, '')  // Remove comments
              .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');  // Unwrap CDATA
          }

          feed = await lenientParser.parseString(xmlContent);
        } catch (lenientError) {
          // If lenient also fails, throw the original error
          throw parseError;
        }
      }

      const items = [];

      for (const entry of feed.items || []) {
        // Filter by keywords if configured
        if (config.keywords?.length) {
          const text = `${entry.title} ${entry.contentSnippet || entry.content || ''}`.toLowerCase();
          const matches = config.keywords.some(kw => text.includes(kw.toLowerCase()));
          if (!matches) continue;
        }

        // Skip if no title or link
        if (!entry.title || !entry.link) continue;

        const item = {
          title: cleanText(entry.title),
          summary: cleanText(entry.contentSnippet || extractSummary(entry.content)),
          content: entry.contentEncoded || entry.content,
          sourceUrl: entry.link,
          publicationDate: parseDate(entry.pubDate || entry.isoDate || entry.dcDate),
          regions: [{ code: region, name: getRegionName(region) }],
          updateType: determineUpdateType(entry, config),
          impactLevel: determineImpactLevel(entry),
          metadata: {
            author: entry.creator || entry.author,
            categories: entry.categories
          },
          hash: generateHash(entry.title + entry.link)
        };

        items.push(item);
      }

      logger.debug(`Parsed ${items.length} items from RSS: ${rssUrl}`);
      return items;
    } catch (error) {
      logger.error(`RSS fetch error for ${rssUrl}:`, error.message);
      throw error;
    }
  }
};

// Helper functions
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSummary(content, maxLength = 500) {
  if (!content) return '';
  const cleaned = cleanText(content);
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength).trim() + '...';
}

function parseDate(dateStr) {
  if (!dateStr) return new Date();
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function determineUpdateType(entry, config) {
  const text = `${entry.title} ${entry.categories?.join(' ') || ''}`.toLowerCase();

  if (text.includes('enforcement') || text.includes('fine') || text.includes('penalty')) {
    return 'enforcement';
  }
  if (text.includes('guidance') || text.includes('guideline')) {
    return 'guidance';
  }
  if (text.includes('amendment') || text.includes('update') || text.includes('revision')) {
    return 'amendment';
  }
  if (text.includes('opinion') || text.includes('recommendation')) {
    return 'opinion';
  }
  if (text.includes('research') || text.includes('study') || text.includes('report')) {
    return 'research';
  }
  if (text.includes('breach') || text.includes('incident')) {
    return 'breach';
  }
  if (text.includes('rule') || text.includes('rulemaking')) {
    return 'rulemaking';
  }

  return 'news';
}

function determineImpactLevel(entry) {
  const text = `${entry.title} ${entry.contentSnippet || ''}`.toLowerCase();

  // High impact keywords
  if (text.includes('major') || text.includes('significant') ||
      text.includes('landmark') || text.includes('historic') ||
      text.includes('million') || text.includes('billion')) {
    return 'high';
  }

  // Critical keywords
  if (text.includes('urgent') || text.includes('immediate') ||
      text.includes('critical') || text.includes('breaking')) {
    return 'critical';
  }

  // Low impact keywords
  if (text.includes('minor') || text.includes('clarification') ||
      text.includes('reminder')) {
    return 'low';
  }

  return 'medium';
}

function generateHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

function getRegionName(code) {
  const regionNames = {
    EU: 'European Union',
    US: 'United States',
    UK: 'United Kingdom',
    CA: 'Canada',
    AU: 'Australia',
    DE: 'Germany',
    FR: 'France',
    IT: 'Italy',
    ES: 'Spain',
    NL: 'Netherlands',
    IE: 'Ireland',
    SG: 'Singapore',
    JP: 'Japan',
    CN: 'China',
    IN: 'India',
    BR: 'Brazil',
    ZA: 'South Africa',
    KE: 'Kenya',
    MX: 'Mexico',
    AR: 'Argentina',
    AE: 'UAE',
    KR: 'South Korea',
    GLOBAL: 'Global',
    'US-CA': 'California, US',
    'US-CO': 'Colorado, US',
    'US-VA': 'Virginia, US',
    'US-CT': 'Connecticut, US',
    'US-UT': 'Utah, US',
    'CA-QC': 'Quebec, Canada'
  };
  return regionNames[code] || code;
}

export default rssScraper;
