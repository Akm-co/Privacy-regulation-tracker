import { Router } from 'express';
import { Report, Update, Enforcement, Regulation } from '../models/index.js';
import { authenticate, requireFeature } from '../middleware/auth.js';
import { reportLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Get all reports for user
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, type } = req.query;

  const query = { userId: req.user._id };
  if (status) query.status = status;
  if (type) query.type = type;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [reports, total] = await Promise.all([
    Report.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit))
      .select('title type status format generatedAt fileUrl pageCount downloadCount')
      .lean(),
    Report.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: reports,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// Generate a new report
router.post('/generate', authenticate, requireFeature('export-pdf'), reportLimiter, asyncHandler(async (req, res) => {
  const {
    title,
    type,
    regions,
    regulations,
    dateRange,
    sections,
    detailLevel,
    branding,
    format
  } = req.body;

  // Validate required fields
  if (!type) {
    throw new ValidationError([{ field: 'type', message: 'Report type is required' }]);
  }

  // Create report record
  const report = new Report({
    userId: req.user._id,
    title: title || `${type.charAt(0).toUpperCase() + type.slice(1)} Report - ${new Date().toLocaleDateString()}`,
    type,
    config: {
      regions: regions || [],
      regulations: regulations || [],
      dateRange: {
        start: dateRange?.start ? new Date(dateRange.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: dateRange?.end ? new Date(dateRange.end) : new Date()
      },
      sections: sections || ['executive-summary', 'recent-updates', 'enforcement-actions'],
      detailLevel: detailLevel || 'standard',
      branding: branding || {}
    },
    format: format || 'pdf',
    status: 'pending',
    metadata: {
      requestedAt: new Date()
    }
  });

  await report.save();

  // Queue report generation (would be handled by background job)
  // For now, we'll do a synchronous generation for demonstration
  try {
    await generateReportContent(report);
  } catch (error) {
    logger.error('Report generation failed:', error);
    report.status = 'failed';
    report.error = {
      message: error.message,
      occurredAt: new Date()
    };
    await report.save();
  }

  res.status(202).json({
    success: true,
    data: {
      reportId: report._id,
      status: report.status,
      message: 'Report generation started'
    }
  });
}));

// Report generation logic
async function generateReportContent(report) {
  report.status = 'generating';
  await report.save();

  const { config } = report;

  // Gather data based on report type and config
  const data = {};

  // Get updates
  const updateQuery = {
    publicationDate: {
      $gte: config.dateRange.start,
      $lte: config.dateRange.end
    }
  };

  if (config.regions?.length) {
    updateQuery['regions.code'] = { $in: config.regions };
  }

  if (config.regulations?.length) {
    updateQuery.regulations = { $in: config.regulations };
  }

  data.updates = await Update.find(updateQuery)
    .sort('-publicationDate')
    .limit(100)
    .populate('regulations', 'name acronym')
    .lean();

  // Get enforcements
  const enforcementQuery = {
    date: {
      $gte: config.dateRange.start,
      $lte: config.dateRange.end
    }
  };

  if (config.regions?.length) {
    enforcementQuery.country = { $in: config.regions };
  }

  if (config.regulations?.length) {
    enforcementQuery.regulation = { $in: config.regulations };
  }

  data.enforcements = await Enforcement.find(enforcementQuery)
    .sort('-date')
    .limit(50)
    .populate('regulation', 'name acronym')
    .lean();

  // Get regulations
  if (config.regulations?.length) {
    data.regulations = await Regulation.find({
      _id: { $in: config.regulations }
    }).lean();
  } else if (config.regions?.length) {
    data.regulations = await Regulation.find({
      'jurisdiction.region': { $in: config.regions },
      status: 'active'
    }).lean();
  }

  // Calculate statistics
  data.statistics = {
    totalUpdates: data.updates.length,
    totalEnforcements: data.enforcements.length,
    totalFines: data.enforcements.reduce((sum, e) => sum + (e.fineAmountUSD || 0), 0),
    avgFine: data.enforcements.length > 0
      ? Math.round(data.enforcements.reduce((sum, e) => sum + (e.fineAmountUSD || 0), 0) / data.enforcements.length)
      : 0,
    byRegion: {},
    byType: {}
  };

  // Count by region
  data.updates.forEach(u => {
    u.regions?.forEach(r => {
      data.statistics.byRegion[r.code] = (data.statistics.byRegion[r.code] || 0) + 1;
    });
  });

  // Count by type
  data.updates.forEach(u => {
    data.statistics.byType[u.updateType] = (data.statistics.byType[u.updateType] || 0) + 1;
  });

  // Generate executive summary
  const executiveSummary = generateExecutiveSummary(data, config);

  // Build report content
  report.content = {
    executiveSummary,
    statistics: data.statistics,
    sections: []
  };

  // Add sections based on configuration
  if (config.sections.includes('recent-updates')) {
    report.content.sections.push({
      title: 'Recent Regulatory Updates',
      content: formatUpdatesSection(data.updates, config.detailLevel)
    });
  }

  if (config.sections.includes('enforcement-actions')) {
    report.content.sections.push({
      title: 'Enforcement Actions',
      content: formatEnforcementsSection(data.enforcements, config.detailLevel)
    });
  }

  if (config.sections.includes('regulatory-landscape')) {
    report.content.sections.push({
      title: 'Regulatory Landscape',
      content: formatRegulationsSection(data.regulations, config.detailLevel)
    });
  }

  // TODO: Generate actual PDF file using Puppeteer or PDFKit
  // For now, we'll mark as completed with placeholder file URL
  report.status = 'completed';
  report.generatedAt = new Date();
  report.generationDuration = Date.now() - report.metadata.requestedAt.getTime();
  report.pageCount = Math.ceil(data.updates.length / 5) + Math.ceil(data.enforcements.length / 10) + 2;

  // Placeholder file URL - would be S3 or similar in production
  report.fileUrl = `/api/reports/${report._id}/download`;

  await report.save();
}

function generateExecutiveSummary(data, config) {
  const period = `${config.dateRange.start.toLocaleDateString()} to ${config.dateRange.end.toLocaleDateString()}`;

  return `This report covers privacy regulatory activity from ${period}.

Key Highlights:
- ${data.statistics.totalUpdates} regulatory updates were identified
- ${data.statistics.totalEnforcements} enforcement actions were recorded
- Total fines imposed: $${data.statistics.totalFines.toLocaleString()}
- Average fine amount: $${data.statistics.avgFine.toLocaleString()}

${data.statistics.totalEnforcements > 0 ? `The largest enforcement action was against ${data.enforcements[0]?.company} for $${data.enforcements[0]?.fineAmountUSD?.toLocaleString()}.` : ''}`;
}

function formatUpdatesSection(updates, detailLevel) {
  if (detailLevel === 'brief') {
    return updates.slice(0, 10).map(u => `- ${u.title} (${u.publicationDate.toLocaleDateString()})`).join('\n');
  }

  return updates.slice(0, 20).map(u =>
    `### ${u.title}\n${u.summary}\n*Published: ${u.publicationDate.toLocaleDateString()} | Impact: ${u.impactLevel}*\n`
  ).join('\n');
}

function formatEnforcementsSection(enforcements, detailLevel) {
  if (detailLevel === 'brief') {
    return enforcements.slice(0, 10).map(e =>
      `- ${e.company}: $${e.fineAmountUSD?.toLocaleString()} (${e.date.toLocaleDateString()})`
    ).join('\n');
  }

  return enforcements.slice(0, 20).map(e =>
    `### ${e.company}\n**Fine:** $${e.fineAmountUSD?.toLocaleString()} | **Authority:** ${e.authority}\n${e.summary}\n`
  ).join('\n');
}

function formatRegulationsSection(regulations, detailLevel) {
  return regulations?.map(r =>
    `### ${r.name} (${r.acronym || 'N/A'})\n${r.summary}\n`
  ).join('\n') || 'No regulations specified.';
}

// Get report status
router.get('/:id/status', authenticate, asyncHandler(async (req, res) => {
  const report = await Report.findOne({
    _id: req.params.id,
    userId: req.user._id
  }).select('status error generatedAt fileUrl');

  if (!report) {
    throw new NotFoundError('Report');
  }

  res.json({
    success: true,
    data: {
      status: report.status,
      error: report.error,
      generatedAt: report.generatedAt,
      fileUrl: report.status === 'completed' ? report.fileUrl : null
    }
  });
}));

// Get report details
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const report = await Report.findOne({
    _id: req.params.id,
    userId: req.user._id
  }).populate('config.regulations', 'name acronym');

  if (!report) {
    throw new NotFoundError('Report');
  }

  res.json({
    success: true,
    data: report
  });
}));

// Download report
router.get('/:id/download', authenticate, asyncHandler(async (req, res) => {
  const report = await Report.findOne({
    _id: req.params.id,
    $or: [
      { userId: req.user._id },
      { 'shared.isShared': true }
    ]
  });

  if (!report) {
    throw new NotFoundError('Report');
  }

  if (report.status !== 'completed') {
    return res.status(400).json({
      success: false,
      error: 'Report not yet generated'
    });
  }

  // Record download
  report.recordDownload();
  await report.save();

  // In production, this would redirect to S3 signed URL or stream the file
  // For now, return the content as JSON
  res.json({
    success: true,
    data: {
      title: report.title,
      format: report.format,
      content: report.content,
      generatedAt: report.generatedAt
    }
  });
}));

// Delete report
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const report = await Report.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!report) {
    throw new NotFoundError('Report');
  }

  res.json({
    success: true,
    message: 'Report deleted'
  });
}));

// Schedule recurring report
router.post('/:id/schedule', authenticate, asyncHandler(async (req, res) => {
  const { frequency, dayOfWeek, dayOfMonth, time, emailTo } = req.body;

  const report = await Report.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!report) {
    throw new NotFoundError('Report');
  }

  report.schedule = {
    enabled: true,
    frequency,
    dayOfWeek,
    dayOfMonth,
    time: time || '09:00',
    timezone: req.user.preferences?.timezone || 'UTC',
    emailTo: emailTo || [req.user.email]
  };

  report.calculateNextScheduledRun();
  await report.save();

  res.json({
    success: true,
    data: {
      schedule: report.schedule
    }
  });
}));

// Get scheduled reports
router.get('/schedules/list', authenticate, asyncHandler(async (req, res) => {
  const reports = await Report.find({
    userId: req.user._id,
    'schedule.enabled': true
  }).select('title type schedule config');

  res.json({
    success: true,
    data: reports
  });
}));

// Cancel schedule
router.delete('/:id/schedule', authenticate, asyncHandler(async (req, res) => {
  const report = await Report.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { 'schedule.enabled': false },
    { new: true }
  );

  if (!report) {
    throw new NotFoundError('Report');
  }

  res.json({
    success: true,
    message: 'Schedule cancelled'
  });
}));

// Generate share link
router.post('/:id/share', authenticate, asyncHandler(async (req, res) => {
  const { expirationDays = 7 } = req.body;

  const report = await Report.findOne({
    _id: req.params.id,
    userId: req.user._id,
    status: 'completed'
  });

  if (!report) {
    throw new NotFoundError('Report');
  }

  const shareToken = report.generateShareLink(expirationDays);
  await report.save();

  res.json({
    success: true,
    data: {
      shareUrl: `/reports/shared/${shareToken}`,
      expiresAt: report.shared.shareExpires
    }
  });
}));

// Access shared report
router.get('/shared/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;

  const report = await Report.findOne({
    'shared.shareToken': token,
    'shared.shareExpires': { $gt: new Date() }
  });

  if (!report) {
    throw new NotFoundError('Report or share link expired');
  }

  // Increment view count
  report.shared.shareViews++;
  await report.save();

  res.json({
    success: true,
    data: {
      title: report.title,
      type: report.type,
      content: report.content,
      generatedAt: report.generatedAt
    }
  });
}));

export default router;
