import 'dotenv/config';
import mongoose from 'mongoose';
import { Regulation, Update, Enforcement } from '../models/index.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/regwatch';

// Sample regulations data
const regulations = [
  {
    name: 'GDPR',
    fullName: 'General Data Protection Regulation',
    jurisdiction: {
      type: 'supranational',
      region: 'EU',
      countries: [
        { code: 'DE', name: 'Germany' },
        { code: 'FR', name: 'France' },
        { code: 'IT', name: 'Italy' },
        { code: 'ES', name: 'Spain' },
        { code: 'NL', name: 'Netherlands' },
        { code: 'IE', name: 'Ireland' }
      ]
    },
    effectiveDate: new Date('2018-05-25'),
    status: 'active',
    summary: 'The General Data Protection Regulation is a regulation in EU law on data protection and privacy in the European Union and the European Economic Area. It also addresses the transfer of personal data outside the EU and EEA areas.',
    fullTextUrl: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
    tags: ['personal-data', 'consent', 'breach-notification', 'data-subject-rights', 'privacy-by-design'],
    strictnessScore: 9.5,
    keyArticles: [
      { number: '5', title: 'Principles relating to processing of personal data' },
      { number: '6', title: 'Lawfulness of processing' },
      { number: '7', title: 'Conditions for consent' },
      { number: '17', title: 'Right to erasure (right to be forgotten)' },
      { number: '25', title: 'Data protection by design and by default' },
      { number: '33', title: 'Notification of a personal data breach' },
      { number: '35', title: 'Data protection impact assessment' }
    ],
    keyRequirements: [
      { category: 'consent', requirement: 'Obtain clear, affirmative consent for data processing' },
      { category: 'transparency', requirement: 'Provide clear privacy notices' },
      { category: 'data-subject-rights', requirement: 'Enable data subject access requests within 30 days' },
      { category: 'breach-notification', requirement: 'Notify authority within 72 hours of breach discovery' },
      { category: 'dpo', requirement: 'Appoint Data Protection Officer if required' },
      { category: 'dpia', requirement: 'Conduct Data Protection Impact Assessments for high-risk processing' }
    ]
  },
  {
    name: 'CCPA',
    fullName: 'California Consumer Privacy Act',
    jurisdiction: {
      type: 'state',
      region: 'North America',
      countries: [{ code: 'US', name: 'United States' }]
    },
    effectiveDate: new Date('2020-01-01'),
    status: 'active',
    summary: 'The California Consumer Privacy Act gives California residents new rights regarding their personal information and imposes various data protection duties on certain businesses conducting business in California.',
    fullTextUrl: 'https://oag.ca.gov/privacy/ccpa',
    tags: ['personal-data', 'consumer-rights', 'opt-out', 'sale-of-data', 'privacy'],
    strictnessScore: 7.5,
    keyArticles: [
      { number: '1798.100', title: 'Right to Know' },
      { number: '1798.105', title: 'Right to Delete' },
      { number: '1798.110', title: 'Right to Know What Personal Information is Collected' },
      { number: '1798.120', title: 'Right to Opt-Out of Sale' },
      { number: '1798.125', title: 'Right to Non-Discrimination' }
    ],
    keyRequirements: [
      { category: 'disclosure', requirement: 'Disclose data collection practices in privacy policy' },
      { category: 'consumer-rights', requirement: 'Respond to consumer requests within 45 days' },
      { category: 'opt-out', requirement: 'Provide "Do Not Sell My Personal Information" link' },
      { category: 'verification', requirement: 'Verify identity of consumers making requests' }
    ]
  },
  {
    name: 'LGPD',
    fullName: 'Lei Geral de Proteção de Dados',
    jurisdiction: {
      type: 'national',
      region: 'South America',
      countries: [{ code: 'BR', name: 'Brazil' }]
    },
    effectiveDate: new Date('2020-09-18'),
    status: 'active',
    summary: 'Brazil\'s General Data Protection Law regulates the processing of personal data of individuals in Brazil, regardless of where the data processor is located.',
    fullTextUrl: 'https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd',
    tags: ['personal-data', 'consent', 'data-subject-rights', 'privacy'],
    strictnessScore: 8.0,
    keyRequirements: [
      { category: 'legal-basis', requirement: 'Establish legal basis for processing' },
      { category: 'consent', requirement: 'Obtain specific, informed consent' },
      { category: 'dpo', requirement: 'Appoint Data Protection Officer' },
      { category: 'data-subject-rights', requirement: 'Respond to data subject requests within 15 days' }
    ]
  },
  {
    name: 'PIPL',
    fullName: 'Personal Information Protection Law',
    jurisdiction: {
      type: 'national',
      region: 'Asia Pacific',
      countries: [{ code: 'CN', name: 'China' }]
    },
    effectiveDate: new Date('2021-11-01'),
    status: 'active',
    summary: 'China\'s comprehensive data protection law that regulates how personal information of individuals in China is processed.',
    fullTextUrl: 'http://www.npc.gov.cn/npc/c30834/202108/a8c4e3672c74491a80b53a172bb753fe.shtml',
    tags: ['personal-data', 'consent', 'cross-border-transfer', 'localization'],
    strictnessScore: 9.0,
    keyRequirements: [
      { category: 'consent', requirement: 'Obtain separate consent for sensitive data processing' },
      { category: 'localization', requirement: 'Store certain data within China' },
      { category: 'cross-border', requirement: 'Conduct security assessment for cross-border transfers' },
      { category: 'breach-notification', requirement: 'Notify authorities immediately upon breach' }
    ]
  },
  {
    name: 'UK GDPR',
    fullName: 'UK General Data Protection Regulation',
    jurisdiction: {
      type: 'national',
      region: 'Europe',
      countries: [{ code: 'GB', name: 'United Kingdom' }]
    },
    effectiveDate: new Date('2021-01-01'),
    status: 'active',
    summary: 'The UK GDPR is the UK\'s version of the EU GDPR, retained in UK law after Brexit with some modifications.',
    fullTextUrl: 'https://www.legislation.gov.uk/eur/2016/679/contents',
    tags: ['personal-data', 'consent', 'breach-notification', 'data-subject-rights'],
    strictnessScore: 9.0,
    keyRequirements: [
      { category: 'consent', requirement: 'Obtain clear, affirmative consent' },
      { category: 'breach-notification', requirement: 'Notify ICO within 72 hours of breach' },
      { category: 'dpo', requirement: 'Appoint DPO if required' }
    ]
  },
  {
    name: 'PDPA',
    fullName: 'Personal Data Protection Act',
    jurisdiction: {
      type: 'national',
      region: 'Asia Pacific',
      countries: [{ code: 'SG', name: 'Singapore' }]
    },
    effectiveDate: new Date('2014-07-02'),
    status: 'active',
    summary: 'Singapore\'s Personal Data Protection Act governs the collection, use, disclosure and care of personal data.',
    fullTextUrl: 'https://sso.agc.gov.sg/Act/PDPA2012',
    tags: ['personal-data', 'consent', 'do-not-call'],
    strictnessScore: 7.0,
    keyRequirements: [
      { category: 'consent', requirement: 'Obtain consent before collecting personal data' },
      { category: 'purpose-limitation', requirement: 'Use data only for stated purposes' },
      { category: 'breach-notification', requirement: 'Notify PDPC within 3 days of significant breach' }
    ]
  },
  {
    name: 'DPDP Act',
    fullName: 'Digital Personal Data Protection Act',
    jurisdiction: {
      type: 'national',
      region: 'Asia Pacific',
      countries: [{ code: 'IN', name: 'India' }]
    },
    effectiveDate: new Date('2023-08-11'),
    status: 'active',
    summary: 'India\'s Digital Personal Data Protection Act establishes comprehensive requirements for processing digital personal data, including consent management, data fiduciary obligations, and data principal rights.',
    fullTextUrl: 'https://www.meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf',
    tags: ['personal-data', 'consent', 'data-fiduciary', 'data-principal-rights'],
    strictnessScore: 7.5,
    keyRequirements: [
      { category: 'consent', requirement: 'Obtain free, specific, informed consent' },
      { category: 'data-fiduciary', requirement: 'Implement appropriate security safeguards' },
      { category: 'data-principal-rights', requirement: 'Enable data correction and erasure requests' },
      { category: 'cross-border', requirement: 'Transfer data only to notified countries' },
      { category: 'breach-notification', requirement: 'Notify Data Protection Board of breaches' }
    ]
  },
  {
    name: 'APPI',
    fullName: 'Act on the Protection of Personal Information',
    jurisdiction: {
      type: 'national',
      region: 'Asia Pacific',
      countries: [{ code: 'JP', name: 'Japan' }]
    },
    effectiveDate: new Date('2022-04-01'),
    status: 'active',
    summary: 'Japan\'s amended Act on the Protection of Personal Information with enhanced requirements for pseudonymized data, cross-border transfers, and individual rights.',
    fullTextUrl: 'https://www.ppc.go.jp/en/legal/',
    tags: ['personal-data', 'consent', 'pseudonymization', 'cross-border-transfer'],
    strictnessScore: 7.0,
    keyRequirements: [
      { category: 'consent', requirement: 'Obtain consent for sensitive personal information' },
      { category: 'transparency', requirement: 'Provide clear purpose of use notification' },
      { category: 'cross-border', requirement: 'Obtain consent or ensure adequate protection for transfers' },
      { category: 'breach-notification', requirement: 'Report breaches to PPC and notify individuals' }
    ]
  },
  {
    name: 'PIPA',
    fullName: 'Personal Information Protection Act',
    jurisdiction: {
      type: 'national',
      region: 'Asia Pacific',
      countries: [{ code: 'KR', name: 'South Korea' }]
    },
    effectiveDate: new Date('2020-08-05'),
    status: 'active',
    summary: 'South Korea\'s Personal Information Protection Act is one of the strictest data protection laws in Asia, with comprehensive requirements for consent, data handling, and cross-border transfers.',
    fullTextUrl: 'https://www.pipc.go.kr/eng/index.do',
    tags: ['personal-data', 'consent', 'pseudonymization', 'data-localization'],
    strictnessScore: 8.5,
    keyRequirements: [
      { category: 'consent', requirement: 'Obtain explicit consent for collection and use' },
      { category: 'pseudonymization', requirement: 'Apply pseudonymization for research purposes' },
      { category: 'cross-border', requirement: 'Notify individuals of overseas transfers' },
      { category: 'breach-notification', requirement: 'Notify within 72 hours of discovery' }
    ]
  },
  {
    name: 'Privacy Act',
    fullName: 'Privacy Act 1988',
    jurisdiction: {
      type: 'national',
      region: 'Asia Pacific',
      countries: [{ code: 'AU', name: 'Australia' }]
    },
    effectiveDate: new Date('1988-03-21'),
    status: 'active',
    summary: 'Australia\'s Privacy Act regulates the handling of personal information by Australian Government agencies and private sector organizations, including the Australian Privacy Principles (APPs).',
    fullTextUrl: 'https://www.oaic.gov.au/privacy/the-privacy-act',
    tags: ['personal-data', 'APP', 'privacy-principles', 'notifiable-data-breach'],
    strictnessScore: 6.5,
    keyRequirements: [
      { category: 'collection', requirement: 'Collect only necessary personal information' },
      { category: 'transparency', requirement: 'Maintain and publish APP privacy policy' },
      { category: 'security', requirement: 'Take reasonable steps to protect personal information' },
      { category: 'breach-notification', requirement: 'Notify OAIC of eligible data breaches' }
    ]
  }
];

// Sample updates data with REAL working URLs
const updates = [
  {
    title: 'EDPB Guidelines on the Use of Facial Recognition Technology',
    summary: 'The European Data Protection Board has adopted guidelines on facial recognition technology in the area of law enforcement, providing clarity on GDPR compliance.',
    content: 'The EDPB guidelines cover key areas including the lawfulness of biometric data processing, transparency requirements, and data protection impact assessments.',
    sourceUrl: 'https://edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052022-use-facial-recognition-technology-area_en',
    sourceName: 'EDPB',
    sourceTier: 1,
    publicationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    regions: [{ country: 'EU', name: 'European Union' }],
    updateType: 'guidance',
    impactLevel: 'high',
    tags: ['AI', 'GDPR', 'facial-recognition', 'biometrics'],
    verified: true
  },
  {
    title: 'California Privacy Rights Act (CPRA) Regulations',
    summary: 'The California Privacy Protection Agency has published CPRA regulations establishing detailed requirements for businesses regarding consumer privacy rights.',
    content: 'The regulations address opt-out preference signals, data broker registration, risk assessments, and cybersecurity audits.',
    sourceUrl: 'https://cppa.ca.gov/regulations/',
    sourceName: 'California Privacy Protection Agency',
    sourceTier: 1,
    publicationDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    regions: [{ country: 'US', name: 'United States', state: 'CA' }],
    updateType: 'amendment',
    impactLevel: 'critical',
    tags: ['CPRA', 'CCPA', 'California', 'regulations'],
    verified: true
  },
  {
    title: 'ICO Guide to International Data Transfers',
    summary: 'The UK Information Commissioner\'s Office guidance on international data transfers, covering transfer mechanisms and risk assessments.',
    content: 'The guidance covers the UK International Data Transfer Agreement, standard contractual clauses, and conducting transfer impact assessments.',
    sourceUrl: 'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/',
    sourceName: 'ICO',
    sourceTier: 1,
    publicationDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    regions: [{ country: 'GB', name: 'United Kingdom' }],
    updateType: 'guidance',
    impactLevel: 'medium',
    tags: ['international-transfers', 'UK-GDPR', 'adequacy', 'SCCs'],
    verified: true
  },
  {
    title: 'Brazil LGPD - Data Subject Rights Guide',
    summary: 'The Brazilian National Data Protection Authority guidance on data subject rights under the LGPD.',
    content: 'Organizations must understand and implement proper procedures for handling data subject access requests and breach notifications.',
    sourceUrl: 'https://www.gov.br/anpd/pt-br/assuntos/noticias',
    sourceName: 'ANPD Brazil',
    sourceTier: 1,
    publicationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    regions: [{ country: 'BR', name: 'Brazil' }],
    updateType: 'guidance',
    impactLevel: 'high',
    tags: ['LGPD', 'data-subject-rights', 'Brazil'],
    verified: true
  },
  {
    title: 'Singapore Model AI Governance Framework',
    summary: 'The Personal Data Protection Commission of Singapore Model AI Governance Framework for responsible AI deployment.',
    content: 'The framework addresses explainability requirements, fairness considerations, and human oversight in AI systems.',
    sourceUrl: 'https://www.pdpc.gov.sg/help-and-resources/2020/01/model-ai-governance-framework',
    sourceName: 'PDPC Singapore',
    sourceTier: 1,
    publicationDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    regions: [{ country: 'SG', name: 'Singapore' }],
    updateType: 'guidance',
    impactLevel: 'medium',
    tags: ['AI', 'PDPA', 'Singapore', 'governance'],
    verified: true
  },
  {
    title: 'FTC Commercial Surveillance and Data Security Rulemaking',
    summary: 'The Federal Trade Commission advance notice of proposed rulemaking on commercial surveillance and data security.',
    content: 'The proposed rules would establish data minimization requirements and mandatory security practices for companies collecting consumer data.',
    sourceUrl: 'https://www.ftc.gov/legal-library/browse/federal-register-notices/commercial-surveillance-data-security-rulemaking',
    sourceName: 'FTC',
    sourceTier: 1,
    publicationDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    regions: [{ country: 'US', name: 'United States' }],
    updateType: 'news',
    impactLevel: 'critical',
    tags: ['FTC', 'commercial-surveillance', 'data-security', 'federal'],
    verified: true
  },
  {
    title: 'China PIPL - Cross-Border Data Transfer Measures',
    summary: 'The Cyberspace Administration of China measures for the security assessment of outbound data transfers.',
    content: 'The regulations specify requirements for security assessments, standard contracts, and certification mechanisms.',
    sourceUrl: 'http://www.cac.gov.cn/2022-07/07/c_1658811536396503.htm',
    sourceName: 'CAC China',
    sourceTier: 1,
    publicationDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    regions: [{ country: 'CN', name: 'China' }],
    updateType: 'amendment',
    impactLevel: 'high',
    tags: ['PIPL', 'cross-border', 'China', 'data-localization'],
    verified: true
  },
  {
    title: 'IAPP Privacy Governance Report',
    summary: 'The International Association of Privacy Professionals research on privacy program governance and trends.',
    content: 'Key findings on privacy governance, budgets, and organizational structures.',
    sourceUrl: 'https://iapp.org/resources/article/privacy-governance-report/',
    sourceName: 'IAPP',
    sourceTier: 2,
    publicationDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    regions: [{ country: 'GLOBAL', name: 'Global' }],
    updateType: 'research',
    impactLevel: 'low',
    tags: ['research', 'survey', 'privacy-program', 'trends'],
    verified: true
  },
  {
    title: 'India Digital Personal Data Protection Act 2023',
    summary: 'Overview of India\'s Digital Personal Data Protection Act establishing data protection requirements.',
    content: 'The Act establishes data protection board procedures, consent requirements, and data fiduciary obligations.',
    sourceUrl: 'https://www.meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf',
    sourceName: 'MeitY India',
    sourceTier: 1,
    publicationDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    regions: [{ country: 'IN', name: 'India' }],
    updateType: 'amendment',
    impactLevel: 'critical',
    tags: ['DPDP', 'India', 'data-protection', 'compliance'],
    verified: true
  },
  {
    title: 'CNIL Cookies and Trackers Guidelines',
    summary: 'The French data protection authority guidelines on cookies and other trackers under GDPR and ePrivacy.',
    content: 'Guidelines on obtaining valid consent for cookies and making rejection as easy as acceptance.',
    sourceUrl: 'https://www.cnil.fr/en/cookies-and-other-tracking-devices-cnil-publishes-new-guidelines',
    sourceName: 'CNIL',
    sourceTier: 1,
    publicationDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    regions: [{ country: 'FR', name: 'France' }],
    updateType: 'guidance',
    impactLevel: 'high',
    tags: ['GDPR', 'cookies', 'consent', 'trackers'],
    verified: true
  }
];

// Sample enforcements data with REAL working URLs
const enforcements = [
  {
    company: 'Google LLC',
    fineAmount: 150000000,
    currency: 'EUR',
    fineAmountUSD: 163500000,
    authority: 'CNIL',
    country: 'FR',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    violation: 'Non-compliant cookie consent mechanisms making rejection harder than acceptance',
    summary: 'CNIL fined Google for cookie consent violations - users could accept cookies with one click but needed multiple clicks to reject.',
    sourceUrl: 'https://www.cnil.fr/en/cookies-google-fined-150-million-euros',
    appealed: false
  },
  {
    company: 'Meta Platforms Ireland',
    fineAmount: 405000000,
    currency: 'EUR',
    fineAmountUSD: 441450000,
    authority: 'DPC Ireland',
    country: 'IE',
    date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    violation: 'Processing children\'s personal data without valid legal basis under GDPR Article 6',
    summary: 'Record fine for Instagram violations related to children\'s data processing.',
    sourceUrl: 'https://www.dataprotection.ie/en/news-media/press-releases/data-protection-commission-announces-decision-instagram-inquiry',
    appealed: true,
    appealStatus: 'pending'
  },
  {
    company: 'X-Mode Social (Outlogic)',
    fineAmount: 75000000,
    currency: 'USD',
    fineAmountUSD: 75000000,
    authority: 'FTC',
    country: 'US',
    date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    violation: 'Deceptive practices in collection and sale of sensitive location data',
    summary: 'FTC settlement for selling precise location data that could reveal visits to sensitive locations.',
    sourceUrl: 'https://www.ftc.gov/news-events/news/press-releases/2024/01/ftc-order-prohibits-data-broker-x-mode-social-outlogic-selling-sensitive-location-data',
    appealed: false
  },
  {
    company: 'Anthem Inc',
    fineAmount: 16000000,
    currency: 'USD',
    fineAmountUSD: 16000000,
    authority: 'HHS OCR',
    country: 'US',
    date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
    violation: 'HIPAA breach affecting 78.8 million patient records due to cyber attack',
    summary: 'Largest HIPAA settlement ever for data breach resulting from targeted spear phishing.',
    sourceUrl: 'https://www.hhs.gov/about/news/2018/10/15/anthem-pays-ocr-16-million-record-hipaa-settlement-following-largest-health-data-breach-history.html',
    appealed: false
  },
  {
    company: 'Vodafone España',
    fineAmount: 8150000,
    currency: 'EUR',
    fineAmountUSD: 8880000,
    authority: 'AEPD',
    country: 'ES',
    date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    violation: 'Multiple GDPR violations including unlawful data processing and inadequate security',
    summary: 'Spanish DPA imposed fine for various data protection violations affecting customers.',
    sourceUrl: 'https://www.aepd.es/en',
    appealed: true,
    appealStatus: 'pending'
  },
  {
    company: 'Clearview AI',
    fineAmount: 7552800,
    currency: 'GBP',
    fineAmountUSD: 9500000,
    authority: 'ICO',
    country: 'GB',
    date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    violation: 'Collecting facial images from UK residents without consent and failing to delete data',
    summary: 'ICO fined Clearview AI for unlawful processing of UK residents\' biometric data scraped from the internet.',
    sourceUrl: 'https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2022/05/ico-fines-facial-recognition-database-company-clearview-ai-inc/',
    appealed: false
  }
];

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    console.log('Clearing existing data...');
    await Promise.all([
      Regulation.deleteMany({}),
      Update.deleteMany({}),
      Enforcement.deleteMany({})
    ]);

    // Insert regulations
    console.log('Inserting regulations...');
    const insertedRegulations = await Regulation.insertMany(regulations);
    console.log(`Inserted ${insertedRegulations.length} regulations`);

    // Map regulation names to IDs for updates
    const regulationMap = {};
    insertedRegulations.forEach(reg => {
      regulationMap[reg.name] = reg._id;
    });

    // Add regulation references to updates
    const updatesWithRefs = updates.map(update => {
      const regs = [];
      if (update.tags.includes('GDPR') || update.regions[0]?.country === 'EU') {
        regs.push(regulationMap['GDPR']);
      }
      if (update.tags.includes('CCPA') || update.tags.includes('CPRA')) {
        regs.push(regulationMap['CCPA']);
      }
      if (update.tags.includes('LGPD') || update.regions[0]?.country === 'BR') {
        regs.push(regulationMap['LGPD']);
      }
      if (update.tags.includes('PIPL') || update.regions[0]?.country === 'CN') {
        regs.push(regulationMap['PIPL']);
      }
      if (update.tags.includes('UK-GDPR') || update.regions[0]?.country === 'GB') {
        regs.push(regulationMap['UK GDPR']);
      }
      if (update.tags.includes('PDPA') || update.regions[0]?.country === 'SG') {
        regs.push(regulationMap['PDPA']);
      }
      if (update.tags.includes('DPDP') || update.regions[0]?.country === 'IN') {
        regs.push(regulationMap['DPDP Act']);
      }
      if (update.tags.includes('APPI') || update.regions[0]?.country === 'JP') {
        regs.push(regulationMap['APPI']);
      }
      if (update.tags.includes('PIPA') || update.regions[0]?.country === 'KR') {
        regs.push(regulationMap['PIPA']);
      }
      if (update.tags.includes('Privacy-Act') || update.regions[0]?.country === 'AU') {
        regs.push(regulationMap['Privacy Act']);
      }
      return { ...update, regulations: regs.filter(Boolean) };
    });

    // Insert updates
    console.log('Inserting updates...');
    const insertedUpdates = await Update.insertMany(updatesWithRefs);
    console.log(`Inserted ${insertedUpdates.length} updates`);

    // Add regulation references to enforcements
    const enforcementsWithRefs = enforcements.map(enf => {
      let regulation;
      if (enf.country === 'FR' || enf.country === 'IE' || enf.country === 'ES') {
        regulation = regulationMap['GDPR'];
      } else if (enf.country === 'GB') {
        regulation = regulationMap['UK GDPR'];
      } else if (enf.country === 'US') {
        regulation = regulationMap['CCPA'];
      }
      return { ...enf, regulation };
    });

    // Insert enforcements
    console.log('Inserting enforcements...');
    const insertedEnforcements = await Enforcement.insertMany(enforcementsWithRefs);
    console.log(`Inserted ${insertedEnforcements.length} enforcements`);

    console.log('\n=== Seed completed successfully ===');
    console.log(`- ${insertedRegulations.length} regulations`);
    console.log(`- ${insertedUpdates.length} updates`);
    console.log(`- ${insertedEnforcements.length} enforcements`);

  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

seedDatabase();
