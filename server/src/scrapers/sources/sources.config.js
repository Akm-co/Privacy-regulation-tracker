/**
 * Comprehensive Scraping Sources Configuration
 *
 * Defines all sources for privacy regulation monitoring organized by tier and type.
 * Tier 1: Official government/regulatory sources (highest priority, most reliable)
 * Tier 2: Industry and legal sources (high reliability)
 * Tier 3: Research and news sources (moderate reliability, cross-verify)
 */

export const scrapingSources = {
  // =====================================================
  // TIER 1: OFFICIAL GOVERNMENT & REGULATORY SOURCES
  // =====================================================
  tier1: {
    // === EUROPEAN UNION ===
    eu: [
      {
        id: 'eu-official-journal',
        name: 'EU Official Journal',
        url: 'https://eur-lex.europa.eu/oj/direct-access.html',
        rssUrl: 'https://eur-lex.europa.eu/content/rss/rss.html',
        type: 'rss',
        region: 'EU',
        categories: ['legislation', 'amendment'],
        frequency: '*/20 * * * *', // Every 20 mins
        parser: 'eurlex',
        enabled: true
      },
      {
        id: 'edpb',
        name: 'European Data Protection Board',
        url: 'https://edpb.europa.eu',
        newsUrl: 'https://edpb.europa.eu/news_en',
        type: 'scrape',
        region: 'EU',
        categories: ['guidance', 'opinion', 'recommendation'],
        frequency: '*/20 * * * *',
        parser: 'edpb',
        selectors: {
          newsList: '.view-news .views-row, .node--type-news, article.node',
          title: 'h2 a, h3 a, .field--name-title a',
          date: '.field--name-created, time, .date-display-single',
          link: 'h2 a, h3 a, .field--name-title a'
        },
        enabled: true
      },
      {
        id: 'ec-digital-policy',
        name: 'European Commission - Digital Policy',
        url: 'https://digital-strategy.ec.europa.eu/en/policies/data-protection',
        rssUrl: 'https://digital-strategy.ec.europa.eu/en/news/rss.xml',
        type: 'rss',
        region: 'EU',
        categories: ['policy', 'strategy', 'news'],
        frequency: '*/30 * * * *',
        parser: 'generic',
        enabled: true
      }
    ],

    // === UNITED KINGDOM ===
    uk: [
      {
        id: 'ico-uk',
        name: 'UK Information Commissioner\'s Office',
        url: 'https://ico.org.uk',
        newsUrl: 'https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/',
        type: 'scrape',
        region: 'UK',
        categories: ['guidance', 'enforcement', 'news'],
        frequency: '*/20 * * * *',
        parser: 'ico',
        selectors: {
          newsList: '.article-listing__item, .news-item, article',
          title: 'h2 a, h3 a, .article-listing__title a',
          date: '.article-listing__date, time, .date',
          link: 'h2 a, h3 a, .article-listing__title a'
        },
        enabled: true
      },
      {
        id: 'uk-legislation',
        name: 'UK Legislation',
        url: 'https://www.legislation.gov.uk',
        rssUrl: 'https://www.legislation.gov.uk/new/data.feed',
        type: 'rss',
        region: 'UK',
        categories: ['legislation'],
        frequency: '*/30 * * * *',
        parser: 'ukLegislation',
        keywords: ['data protection', 'privacy', 'GDPR', 'digital'],
        enabled: true
      }
    ],

    // === UNITED STATES (Federal) ===
    us_federal: [
      {
        id: 'ftc',
        name: 'Federal Trade Commission',
        url: 'https://www.ftc.gov',
        newsUrl: 'https://www.ftc.gov/news-events/news/press-releases',
        type: 'scrape',
        region: 'US',
        categories: ['enforcement', 'guidance', 'news'],
        frequency: '*/20 * * * *',
        parser: 'ftc',
        selectors: {
          newsList: '.views-row, article.node, .node--type-press-release',
          title: 'h2 a, h3 a, .node__title a',
          date: '.date, time, .field--name-created',
          link: 'h2 a, h3 a, .node__title a'
        },
        keywords: ['privacy', 'data', 'children', 'coppa', 'security'],
        enabled: true
      },
      {
        id: 'federal-register',
        name: 'Federal Register',
        url: 'https://www.federalregister.gov',
        apiUrl: 'https://www.federalregister.gov/api/v1/documents.json',
        type: 'api',
        region: 'US',
        categories: ['legislation', 'rule', 'notice'],
        frequency: '*/20 * * * *',
        parser: 'federalRegister',
        queryParams: {
          conditions: {
            term: 'privacy OR "data protection" OR "personal information"',
            agencies: ['federal-trade-commission', 'consumer-financial-protection-bureau', 'department-of-health-and-human-services']
          },
          per_page: 50,
          order: 'newest'
        },
        enabled: true
      },
      {
        id: 'hhs-ocr',
        name: 'HHS Office for Civil Rights (HIPAA)',
        url: 'https://www.hhs.gov/hipaa',
        newsUrl: 'https://www.hhs.gov/hipaa/for-professionals/compliance-enforcement/index.html',
        rssUrl: 'https://www.hhs.gov/hipaa/rss.xml',
        type: 'scrape',
        region: 'US',
        categories: ['enforcement', 'guidance', 'breach'],
        frequency: '*/30 * * * *',
        parser: 'hhsHipaa',
        selectors: {
          newsList: '.hhs-content-list li',
          title: 'a',
          date: '.date',
          link: 'a'
        },
        enabled: true
      },
      {
        id: 'cfpb',
        name: 'Consumer Financial Protection Bureau',
        url: 'https://www.consumerfinance.gov',
        newsUrl: 'https://www.consumerfinance.gov/about-us/newsroom/',
        rssUrl: 'https://www.consumerfinance.gov/about-us/newsroom/feed/',
        type: 'rss',
        region: 'US',
        categories: ['enforcement', 'rule', 'guidance'],
        frequency: '*/30 * * * *',
        parser: 'cfpb',
        keywords: ['privacy', 'data', 'security', 'glba'],
        enabled: true
      }
    ],

    // === UNITED STATES (State Level) ===
    us_states: [
      {
        id: 'ca-ag-privacy',
        name: 'California Attorney General - Privacy',
        url: 'https://oag.ca.gov/privacy',
        newsUrl: 'https://oag.ca.gov/news',
        rssUrl: 'https://oag.ca.gov/news/feed',
        type: 'rss',
        region: 'US-CA',
        categories: ['enforcement', 'guidance', 'news'],
        frequency: '*/20 * * * *',
        parser: 'caAg',
        keywords: ['CCPA', 'CPRA', 'privacy', 'data'],
        enabled: true
      },
      {
        id: 'cppa-ca',
        name: 'California Privacy Protection Agency',
        url: 'https://cppa.ca.gov',
        newsUrl: 'https://cppa.ca.gov/announcements/',
        type: 'scrape',
        region: 'US-CA',
        categories: ['rulemaking', 'guidance', 'enforcement'],
        frequency: '*/20 * * * *',
        parser: 'cppa',
        selectors: {
          newsList: '.announcement-item',
          title: 'h3',
          date: '.date',
          link: 'a'
        },
        enabled: true
      },
      {
        id: 'co-ag-privacy',
        name: 'Colorado Attorney General - Privacy',
        url: 'https://coag.gov/resources/colorado-privacy-act/',
        type: 'scrape',
        region: 'US-CO',
        categories: ['guidance', 'enforcement'],
        frequency: '0 */6 * * *', // Every 6 hours
        parser: 'coAg',
        enabled: true
      },
      {
        id: 'va-oag-privacy',
        name: 'Virginia Office of Attorney General',
        url: 'https://www.oag.state.va.us',
        type: 'scrape',
        region: 'US-VA',
        categories: ['guidance', 'enforcement'],
        frequency: '0 */6 * * *',
        parser: 'vaOag',
        keywords: ['VCDPA', 'privacy', 'data protection'],
        enabled: true
      },
      {
        id: 'ct-ag-privacy',
        name: 'Connecticut Attorney General',
        url: 'https://portal.ct.gov/AG',
        type: 'scrape',
        region: 'US-CT',
        categories: ['guidance', 'enforcement'],
        frequency: '0 */6 * * *',
        parser: 'ctAg',
        keywords: ['CTDPA', 'privacy', 'data'],
        enabled: true
      },
      {
        id: 'ut-ag-privacy',
        name: 'Utah Attorney General',
        url: 'https://attorneygeneral.utah.gov',
        type: 'scrape',
        region: 'US-UT',
        categories: ['guidance'],
        frequency: '0 */12 * * *',
        parser: 'utAg',
        keywords: ['UCPA', 'privacy'],
        enabled: true
      }
    ],

    // === ASIA-PACIFIC ===
    apac: [
      {
        id: 'china-cac',
        name: 'Cyberspace Administration of China',
        url: 'http://www.cac.gov.cn',
        type: 'scrape',
        region: 'CN',
        categories: ['legislation', 'guidance', 'enforcement'],
        frequency: '*/30 * * * *',
        parser: 'chinaCac',
        language: 'zh',
        enabled: true
      },
      {
        id: 'india-meity',
        name: 'India Ministry of Electronics & IT',
        url: 'https://www.meity.gov.in',
        newsUrl: 'https://www.meity.gov.in/content/latest-news',
        type: 'scrape',
        region: 'IN',
        categories: ['legislation', 'policy', 'guidance'],
        frequency: '*/30 * * * *',
        parser: 'indiaMeity',
        selectors: {
          newsList: '.view-content .views-row, .news-item, article, .item-list li',
          title: 'a, h3 a, h2 a',
          date: '.date, time, .date-display-single',
          link: 'a'
        },
        keywords: ['DPDP', 'digital personal data', 'privacy'],
        enabled: true
      },
      {
        id: 'japan-ppc',
        name: 'Japan Personal Information Protection Commission',
        url: 'https://www.ppc.go.jp',
        newsUrl: 'https://www.ppc.go.jp/en/news/',
        type: 'scrape',
        region: 'JP',
        categories: ['guidance', 'enforcement'],
        frequency: '*/30 * * * *',
        parser: 'japanPpc',
        selectors: {
          newsList: '.news-list li, .news-item, article',
          title: 'a',
          date: '.date, time',
          link: 'a'
        },
        language: 'en',
        enabled: true
      },
      {
        id: 'singapore-pdpc',
        name: 'Singapore Personal Data Protection Commission',
        url: 'https://www.pdpc.gov.sg',
        newsUrl: 'https://www.pdpc.gov.sg/News-and-Events',
        type: 'scrape',
        region: 'SG',
        categories: ['guidance', 'enforcement', 'advisory'],
        frequency: '*/30 * * * *',
        parser: 'sgPdpc',
        selectors: {
          newsList: '.news-item',
          title: 'h3',
          date: '.date',
          link: 'a'
        },
        enabled: true
      },
      {
        id: 'australia-oaic',
        name: 'Australia Office of the Information Commissioner',
        url: 'https://www.oaic.gov.au',
        newsUrl: 'https://www.oaic.gov.au/newsroom',
        type: 'scrape',
        region: 'AU',
        categories: ['guidance', 'enforcement', 'news'],
        frequency: '*/30 * * * *',
        parser: 'oaic',
        selectors: {
          newsList: '.news-listing__item, .views-row, article',
          title: 'h3 a, h2 a, .title a',
          date: '.date, time, .field--name-created',
          link: 'h3 a, h2 a, .title a'
        },
        enabled: true
      },
      {
        id: 'korea-pipc',
        name: 'Korea Personal Information Protection Commission',
        url: 'https://www.pipc.go.kr',
        type: 'scrape',
        region: 'KR',
        categories: ['guidance', 'enforcement'],
        frequency: '0 */6 * * *',
        parser: 'koreaPipc',
        language: 'ko',
        enabled: true
      }
    ],

    // === EUROPE (Individual DPAs) ===
    eu_dpas: [
      {
        id: 'cnil-france',
        name: 'CNIL (France)',
        url: 'https://www.cnil.fr',
        newsUrl: 'https://www.cnil.fr/en/news',
        type: 'scrape',
        region: 'FR',
        categories: ['guidance', 'enforcement', 'news'],
        frequency: '*/20 * * * *',
        parser: 'cnil',
        selectors: {
          newsList: '.node--type-news, article.node, .views-row',
          title: 'h2 a, h3 a, .field--name-title a',
          date: '.field--name-created, time, .date',
          link: 'h2 a, h3 a, .field--name-title a'
        },
        language: 'en',
        enabled: true
      },
      {
        id: 'bfdi-germany',
        name: 'BfDI (Germany)',
        url: 'https://www.bfdi.bund.de',
        newsUrl: 'https://www.bfdi.bund.de/EN/Home/home_node.html',
        type: 'scrape',
        region: 'DE',
        categories: ['guidance', 'news'],
        frequency: '*/30 * * * *',
        parser: 'bfdi',
        selectors: {
          newsList: '.news-teaser, .c-teaser, article',
          title: 'h3 a, h2 a, .c-teaser__title a',
          date: '.date, time, .c-teaser__date',
          link: 'h3 a, h2 a, .c-teaser__title a'
        },
        language: 'en',
        enabled: true
      },
      {
        id: 'aepd-spain',
        name: 'AEPD (Spain)',
        url: 'https://www.aepd.es',
        rssUrl: 'https://www.aepd.es/es/rss.xml',
        type: 'rss',
        region: 'ES',
        categories: ['guidance', 'enforcement', 'news'],
        frequency: '*/30 * * * *',
        parser: 'aepd',
        language: 'es',
        enabled: true
      },
      {
        id: 'garante-italy',
        name: 'Garante Privacy (Italy)',
        url: 'https://www.garanteprivacy.it',
        rssUrl: 'https://www.garanteprivacy.it/web/guest/home/rss',
        type: 'rss',
        region: 'IT',
        categories: ['guidance', 'enforcement'],
        frequency: '*/30 * * * *',
        parser: 'garante',
        language: 'it',
        enabled: true
      },
      {
        id: 'dpc-ireland',
        name: 'Data Protection Commission (Ireland)',
        url: 'https://www.dataprotection.ie',
        newsUrl: 'https://www.dataprotection.ie/en/news-media/press-releases',
        type: 'scrape',
        region: 'IE',
        categories: ['guidance', 'enforcement', 'news'],
        frequency: '*/20 * * * *',
        parser: 'dpcIreland',
        selectors: {
          newsList: '.views-row',
          title: '.views-field-title a',
          date: '.views-field-created',
          link: '.views-field-title a'
        },
        enabled: true
      },
      {
        id: 'ap-netherlands',
        name: 'Autoriteit Persoonsgegevens (Netherlands)',
        url: 'https://www.autoriteitpersoonsgegevens.nl',
        rssUrl: 'https://www.autoriteitpersoonsgegevens.nl/nl/rss',
        type: 'rss',
        region: 'NL',
        categories: ['guidance', 'enforcement'],
        frequency: '*/30 * * * *',
        parser: 'apNl',
        language: 'nl',
        enabled: true
      }
    ],

    // === LATIN AMERICA ===
    latam: [
      {
        id: 'anpd-brazil',
        name: 'ANPD (Brazil)',
        url: 'https://www.gov.br/anpd',
        newsUrl: 'https://www.gov.br/anpd/pt-br/assuntos/noticias',
        type: 'scrape',
        region: 'BR',
        categories: ['guidance', 'enforcement', 'news'],
        frequency: '*/30 * * * *',
        parser: 'anpdBrazil',
        language: 'pt',
        enabled: true
      },
      {
        id: 'aaip-argentina',
        name: 'AAIP (Argentina)',
        url: 'https://www.argentina.gob.ar/aaip',
        type: 'scrape',
        region: 'AR',
        categories: ['guidance', 'news'],
        frequency: '0 */6 * * *',
        parser: 'aaipArgentina',
        language: 'es',
        enabled: true
      },
      {
        id: 'inai-mexico',
        name: 'INAI (Mexico)',
        url: 'https://home.inai.org.mx',
        type: 'scrape',
        region: 'MX',
        categories: ['guidance', 'enforcement'],
        frequency: '0 */6 * * *',
        parser: 'inaiMexico',
        language: 'es',
        enabled: true
      }
    ],

    // === MIDDLE EAST & AFRICA ===
    mea: [
      {
        id: 'uae-dp-office',
        name: 'UAE Data Protection Office',
        url: 'https://www.moj.gov.ae',
        type: 'scrape',
        region: 'AE',
        categories: ['guidance', 'legislation'],
        frequency: '0 */12 * * *',
        parser: 'uaeDp',
        enabled: true
      },
      {
        id: 'south-africa-ir',
        name: 'South Africa Information Regulator',
        url: 'https://inforegulator.org.za',
        newsUrl: 'https://inforegulator.org.za/news/',
        type: 'scrape',
        region: 'ZA',
        categories: ['guidance', 'enforcement', 'news'],
        frequency: '0 */6 * * *',
        parser: 'saInfoReg',
        selectors: {
          newsList: '.news-item',
          title: 'h3',
          date: '.date',
          link: 'a'
        },
        enabled: true
      },
      {
        id: 'kenya-odpc',
        name: 'Kenya Office of Data Protection Commissioner',
        url: 'https://www.odpc.go.ke',
        type: 'scrape',
        region: 'KE',
        categories: ['guidance', 'news'],
        frequency: '0 */12 * * *',
        parser: 'kenyaOdpc',
        enabled: true
      }
    ],

    // === CANADA ===
    canada: [
      {
        id: 'opc-canada',
        name: 'Office of the Privacy Commissioner of Canada',
        url: 'https://www.priv.gc.ca',
        rssUrl: 'https://www.priv.gc.ca/en/rss/',
        type: 'rss',
        region: 'CA',
        categories: ['guidance', 'enforcement', 'news'],
        frequency: '*/30 * * * *',
        parser: 'opcCanada',
        enabled: true
      },
      {
        id: 'cai-quebec',
        name: 'Commission d\'accès à l\'information du Québec',
        url: 'https://www.cai.gouv.qc.ca',
        type: 'scrape',
        region: 'CA-QC',
        categories: ['guidance', 'news'],
        frequency: '0 */6 * * *',
        parser: 'caiQuebec',
        language: 'fr',
        enabled: true
      }
    ]
  },

  // =====================================================
  // TIER 2: INDUSTRY & LEGAL SOURCES
  // =====================================================
  tier2: {
    legal_databases: [
      {
        id: 'lexology',
        name: 'Lexology',
        url: 'https://www.lexology.com',
        rssUrl: 'https://www.lexology.com/rss/hubs/privacy-data-protection',
        type: 'rss',
        region: 'GLOBAL',
        categories: ['analysis', 'news', 'guidance'],
        frequency: '*/30 * * * *',
        parser: 'lexology',
        enabled: true
      },
      {
        id: 'jdsupra-privacy',
        name: 'JD Supra - Privacy',
        url: 'https://www.jdsupra.com/topics/data-protection-and-privacy/',
        rssUrl: 'https://www.jdsupra.com/resources/syndication/rss.aspx?Type=Topics&TopicId=1203',
        type: 'rss',
        region: 'GLOBAL',
        categories: ['analysis', 'news'],
        frequency: '*/30 * * * *',
        parser: 'jdsupra',
        enabled: true
      },
      {
        id: 'dataprotectionreport',
        name: 'Data Protection Report (Norton Rose)',
        url: 'https://www.dataprotectionreport.com',
        rssUrl: 'https://www.dataprotectionreport.com/feed/',
        type: 'rss',
        region: 'GLOBAL',
        categories: ['analysis', 'news'],
        frequency: '0 * * * *',
        parser: 'wordpress',
        enabled: true
      }
    ],

    industry_associations: [
      {
        id: 'iapp',
        name: 'International Association of Privacy Professionals',
        url: 'https://iapp.org',
        newsUrl: 'https://iapp.org/news/all-news/',
        type: 'scrape',
        region: 'GLOBAL',
        categories: ['news', 'research', 'analysis'],
        frequency: '*/30 * * * *',
        parser: 'iapp',
        selectors: {
          newsList: '.article-card, .news-item, article',
          title: 'h2 a, h3 a, .article-title a',
          date: '.article-date, .date, time',
          link: 'h2 a, h3 a, .article-title a'
        },
        enabled: true
      },
      {
        id: 'fpf',
        name: 'Future of Privacy Forum',
        url: 'https://fpf.org',
        rssUrl: 'https://fpf.org/feed/',
        type: 'rss',
        region: 'GLOBAL',
        categories: ['research', 'news'],
        frequency: '0 * * * *',
        parser: 'wordpress',
        enabled: true
      },
      {
        id: 'eff-privacy',
        name: 'Electronic Frontier Foundation - Privacy',
        url: 'https://www.eff.org/issues/privacy',
        rssUrl: 'https://www.eff.org/rss/updates.xml',
        type: 'rss',
        region: 'GLOBAL',
        categories: ['advocacy', 'news', 'analysis'],
        frequency: '*/30 * * * *',
        parser: 'eff',
        keywords: ['privacy', 'data protection', 'surveillance'],
        enabled: true
      },
      {
        id: 'edri',
        name: 'European Digital Rights',
        url: 'https://edri.org',
        rssUrl: 'https://edri.org/feed/',
        type: 'rss',
        region: 'EU',
        categories: ['advocacy', 'news'],
        frequency: '0 * * * *',
        parser: 'wordpress',
        enabled: true
      }
    ],

    news_outlets: [
      {
        id: 'reuters-tech-regulation',
        name: 'Reuters - Technology',
        url: 'https://www.reuters.com/technology/',
        rssUrl: 'https://www.reuters.com/rssfeed/technology',
        type: 'rss',
        region: 'GLOBAL',
        categories: ['news'],
        frequency: '*/20 * * * *',
        parser: 'reuters',
        keywords: ['privacy', 'data protection', 'GDPR', 'regulation'],
        enabled: true
      },
      {
        id: 'techcrunch-privacy',
        name: 'TechCrunch - Privacy',
        url: 'https://techcrunch.com/category/privacy/',
        rssUrl: 'https://techcrunch.com/category/privacy/feed/',
        type: 'rss',
        region: 'GLOBAL',
        categories: ['news'],
        frequency: '*/30 * * * *',
        parser: 'wordpress',
        enabled: true
      },
      {
        id: 'wired-security',
        name: 'Wired - Security',
        url: 'https://www.wired.com/category/security/',
        rssUrl: 'https://www.wired.com/feed/category/security/latest/rss',
        type: 'rss',
        region: 'GLOBAL',
        categories: ['news'],
        frequency: '*/30 * * * *',
        parser: 'wired',
        keywords: ['privacy', 'data protection'],
        enabled: true
      },
      {
        id: 'therecord',
        name: 'The Record by Recorded Future',
        url: 'https://therecord.media',
        rssUrl: 'https://therecord.media/feed/',
        type: 'rss',
        region: 'GLOBAL',
        categories: ['news'],
        frequency: '*/30 * * * *',
        parser: 'wordpress',
        keywords: ['privacy', 'regulation', 'data protection'],
        enabled: true
      }
    ],

    enforcement_trackers: [
      {
        id: 'enforcementtracker',
        name: 'GDPR Enforcement Tracker',
        url: 'https://www.enforcementtracker.com',
        type: 'scrape',
        region: 'EU',
        categories: ['enforcement'],
        frequency: '0 */6 * * *',
        parser: 'enforcementTracker',
        selectors: {
          table: '#enforcementtracker_table',
          rows: 'tbody tr'
        },
        enabled: true
      },
      {
        id: 'gdprhub',
        name: 'GDPRHub Wiki',
        url: 'https://gdprhub.eu',
        type: 'scrape',
        region: 'EU',
        categories: ['enforcement', 'analysis'],
        frequency: '0 */6 * * *',
        parser: 'gdprhub',
        enabled: true
      }
    ]
  },

  // =====================================================
  // TIER 3: RESEARCH & ACADEMIC SOURCES
  // =====================================================
  tier3: {
    academic: [
      {
        id: 'ssrn-privacy',
        name: 'SSRN - Privacy & Data Protection',
        url: 'https://www.ssrn.com',
        searchUrl: 'https://api.ssrn.com/content/v1/papers?keywords=privacy%20data%20protection&sort=date',
        type: 'api',
        region: 'GLOBAL',
        categories: ['research', 'academic'],
        frequency: '0 */12 * * *',
        parser: 'ssrn',
        enabled: true
      },
      {
        id: 'arxiv-privacy',
        name: 'arXiv - Privacy/Security',
        url: 'https://arxiv.org',
        apiUrl: 'http://export.arxiv.org/api/query',
        type: 'api',
        region: 'GLOBAL',
        categories: ['research', 'academic'],
        frequency: '0 */12 * * *',
        parser: 'arxiv',
        queryParams: {
          search_query: 'all:privacy OR all:"data protection"',
          sortBy: 'lastUpdatedDate',
          sortOrder: 'descending',
          max_results: 50
        },
        enabled: true
      }
    ],

    think_tanks: [
      {
        id: 'brookings-tech',
        name: 'Brookings - Technology Innovation',
        url: 'https://www.brookings.edu/topic/technology-innovation/',
        rssUrl: 'https://www.brookings.edu/topic/technology-innovation/feed/',
        type: 'rss',
        region: 'GLOBAL',
        categories: ['research', 'analysis'],
        frequency: '0 */6 * * *',
        parser: 'wordpress',
        keywords: ['privacy', 'data protection', 'regulation'],
        enabled: true
      },
      {
        id: 'cdt',
        name: 'Center for Democracy & Technology',
        url: 'https://cdt.org',
        rssUrl: 'https://cdt.org/feed/',
        type: 'rss',
        region: 'GLOBAL',
        categories: ['research', 'advocacy'],
        frequency: '0 */6 * * *',
        parser: 'wordpress',
        enabled: true
      },
      {
        id: 'accessnow',
        name: 'Access Now',
        url: 'https://www.accessnow.org',
        rssUrl: 'https://www.accessnow.org/feed/',
        type: 'rss',
        region: 'GLOBAL',
        categories: ['advocacy', 'research'],
        frequency: '0 */6 * * *',
        parser: 'wordpress',
        keywords: ['privacy', 'data protection'],
        enabled: true
      }
    ],

    consulting_firms: [
      {
        id: 'pwc-privacy',
        name: 'PwC Privacy Insights',
        url: 'https://www.pwc.com/gx/en/issues/data-and-analytics/data-privacy.html',
        type: 'scrape',
        region: 'GLOBAL',
        categories: ['research', 'analysis'],
        frequency: '0 0 * * *', // Daily
        parser: 'pwc',
        enabled: true
      },
      {
        id: 'deloitte-privacy',
        name: 'Deloitte Privacy',
        url: 'https://www2.deloitte.com/global/en/services/risk/privacy-and-data-protection.html',
        type: 'scrape',
        region: 'GLOBAL',
        categories: ['research'],
        frequency: '0 0 * * *',
        parser: 'deloitte',
        enabled: true
      }
    ]
  }
};

/**
 * Get all enabled sources flattened into a single array
 */
export function getAllEnabledSources() {
  const sources = [];

  for (const tier of Object.values(scrapingSources)) {
    for (const category of Object.values(tier)) {
      if (Array.isArray(category)) {
        sources.push(...category.filter(s => s.enabled));
      }
    }
  }

  return sources;
}

/**
 * Get sources by region
 */
export function getSourcesByRegion(regionCode) {
  return getAllEnabledSources().filter(
    s => s.region === regionCode || s.region === 'GLOBAL'
  );
}

/**
 * Get sources by tier
 */
export function getSourcesByTier(tier) {
  const sources = [];
  const tierData = scrapingSources[tier];

  if (tierData) {
    for (const category of Object.values(tierData)) {
      if (Array.isArray(category)) {
        sources.push(...category.filter(s => s.enabled));
      }
    }
  }

  return sources;
}

/**
 * Get sources by scrape type
 */
export function getSourcesByType(type) {
  return getAllEnabledSources().filter(s => s.type === type);
}

export default scrapingSources;
