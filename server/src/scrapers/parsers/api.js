import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

const apiScraper = {
  async fetch(job) {
    const { config, region, sourceId } = job;
    const apiUrl = config.apiUrl || job.sourceUrl;

    if (!apiUrl) {
      throw new Error(`No API URL configured for ${sourceId}`);
    }

    logger.debug(`Fetching API: ${apiUrl}`);

    try {
      // Build request config
      const requestConfig = {
        headers: {
          'User-Agent': process.env.SCRAPING_USER_AGENT || 'RegWatch/1.0',
          'Accept': 'application/json',
          ...config.headers
        },
        timeout: 30000,
        params: config.queryParams || {}
      };

      const response = await axios.get(apiUrl, requestConfig);
      const data = response.data;

      // Parse based on source type
      let items = [];
      const parser = config.parser;

      switch (parser) {
        case 'federalRegister':
          items = parseFederalRegister(data, region);
          break;
        case 'ssrn':
          items = parseSSRN(data, region);
          break;
        case 'arxiv':
          items = parseArxiv(data, region);
          break;
        default:
          items = parseGenericApi(data, region, config);
      }

      // Filter by keywords if configured
      if (config.keywords?.length) {
        items = items.filter(item => {
          const text = `${item.title} ${item.summary}`.toLowerCase();
          return config.keywords.some(kw => text.includes(kw.toLowerCase()));
        });
      }

      logger.debug(`Parsed ${items.length} items from API: ${apiUrl}`);
      return items;
    } catch (error) {
      logger.error(`API fetch error for ${apiUrl}:`, error.message);
      throw error;
    }
  }
};

// Federal Register API parser
function parseFederalRegister(data, region) {
  const results = data.results || [];
  return results.map(doc => ({
    title: doc.title,
    summary: doc.abstract || doc.excerpts || '',
    content: doc.body_html_url ? null : doc.raw_text,
    sourceUrl: doc.html_url,
    publicationDate: new Date(doc.publication_date),
    regions: [{ code: region, name: 'United States' }],
    updateType: mapFederalRegisterType(doc.type),
    impactLevel: doc.significant ? 'high' : 'medium',
    metadata: {
      documentNumber: doc.document_number,
      agencies: doc.agencies?.map(a => a.name),
      documentType: doc.type,
      effectiveDate: doc.effective_on ? new Date(doc.effective_on) : null
    },
    hash: crypto.createHash('md5').update(doc.document_number).digest('hex')
  }));
}

function mapFederalRegisterType(type) {
  const typeMap = {
    'Rule': 'rulemaking',
    'Proposed Rule': 'rulemaking',
    'Notice': 'news',
    'Presidential Document': 'policy'
  };
  return typeMap[type] || 'news';
}

// SSRN API parser
function parseSSRN(data, region) {
  const papers = data.papers || data.results || [];
  return papers.map(paper => ({
    title: paper.title,
    summary: paper.abstract || '',
    sourceUrl: paper.url || `https://papers.ssrn.com/sol3/papers.cfm?abstract_id=${paper.id}`,
    publicationDate: paper.date ? new Date(paper.date) : new Date(),
    regions: [{ code: 'GLOBAL', name: 'Global' }],
    updateType: 'research',
    impactLevel: 'medium',
    metadata: {
      authors: paper.authors,
      downloads: paper.downloads,
      citations: paper.citations
    },
    hash: crypto.createHash('md5').update(paper.id?.toString() || paper.title).digest('hex')
  }));
}

// arXiv API parser (XML to JSON already converted)
function parseArxiv(data, region) {
  // arXiv returns Atom XML, need to parse it
  const entries = data.feed?.entry || [];
  return entries.map(entry => ({
    title: entry.title?.replace(/\s+/g, ' ').trim(),
    summary: entry.summary?.replace(/\s+/g, ' ').trim() || '',
    sourceUrl: entry.id,
    publicationDate: new Date(entry.published || entry.updated),
    regions: [{ code: 'GLOBAL', name: 'Global' }],
    updateType: 'research',
    impactLevel: 'medium',
    metadata: {
      authors: Array.isArray(entry.author) ?
        entry.author.map(a => a.name) :
        [entry.author?.name].filter(Boolean),
      categories: Array.isArray(entry.category) ?
        entry.category.map(c => c['$']?.term || c.term) :
        [entry.category?.['$']?.term || entry.category?.term].filter(Boolean),
      doi: entry['arxiv:doi']?.['_']
    },
    hash: crypto.createHash('md5').update(entry.id).digest('hex')
  }));
}

// Generic API parser
function parseGenericApi(data, region, config) {
  // Try to find the array of items
  let items = data;
  if (data.results) items = data.results;
  if (data.items) items = data.items;
  if (data.data) items = data.data;
  if (data.entries) items = data.entries;
  if (data.articles) items = data.articles;

  if (!Array.isArray(items)) {
    logger.warn('Could not find items array in API response');
    return [];
  }

  return items.map(item => {
    // Try to extract common fields
    const title = item.title || item.name || item.headline || '';
    const summary = item.summary || item.description || item.abstract ||
      item.excerpt || item.content?.substring(0, 500) || '';
    const url = item.url || item.link || item.href || item.sourceUrl || '';
    const date = item.date || item.publishedAt || item.published ||
      item.created || item.createdAt || item.timestamp;

    return {
      title: title.trim(),
      summary: summary.trim(),
      sourceUrl: url,
      publicationDate: date ? new Date(date) : new Date(),
      regions: [{ code: region, name: getRegionName(region) }],
      updateType: determineUpdateType(title, summary),
      impactLevel: 'medium',
      hash: crypto.createHash('md5').update(title + url).digest('hex')
    };
  }).filter(item => item.title && item.sourceUrl);
}

function determineUpdateType(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();

  if (text.includes('enforcement') || text.includes('fine') || text.includes('penalty')) {
    return 'enforcement';
  }
  if (text.includes('guidance') || text.includes('guideline')) {
    return 'guidance';
  }
  if (text.includes('research') || text.includes('study') || text.includes('paper')) {
    return 'research';
  }
  if (text.includes('rule') || text.includes('regulation')) {
    return 'rulemaking';
  }

  return 'news';
}

function getRegionName(code) {
  const regionNames = {
    EU: 'European Union', US: 'United States', UK: 'United Kingdom',
    GLOBAL: 'Global'
  };
  return regionNames[code] || code;
}

export default apiScraper;
