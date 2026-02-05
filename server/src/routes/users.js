import { Router } from 'express';
import { User } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';

const router = Router();

// Get user preferences
router.get('/preferences', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('preferences')
    .populate('preferences.watchedRegulations', 'name acronym');

  res.json({
    success: true,
    data: user.preferences
  });
}));

// Update user preferences
router.put('/preferences', authenticate, asyncHandler(async (req, res) => {
  const {
    watchedRegions,
    watchedRegulations,
    alertKeywords,
    digestFrequency,
    digestTime,
    timezone,
    theme,
    language,
    emailNotifications
  } = req.body;

  const updates = {};

  if (watchedRegions !== undefined) updates['preferences.watchedRegions'] = watchedRegions;
  if (watchedRegulations !== undefined) updates['preferences.watchedRegulations'] = watchedRegulations;
  if (alertKeywords !== undefined) updates['preferences.alertKeywords'] = alertKeywords;
  if (digestFrequency !== undefined) updates['preferences.digestFrequency'] = digestFrequency;
  if (digestTime !== undefined) updates['preferences.digestTime'] = digestTime;
  if (timezone !== undefined) updates['preferences.timezone'] = timezone;
  if (theme !== undefined) updates['preferences.theme'] = theme;
  if (language !== undefined) updates['preferences.language'] = language;
  if (emailNotifications !== undefined) {
    Object.keys(emailNotifications).forEach(key => {
      updates[`preferences.emailNotifications.${key}`] = emailNotifications[key];
    });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true }
  ).select('preferences');

  res.json({
    success: true,
    data: user.preferences
  });
}));

// Get user alerts
router.get('/alerts', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('alerts');

  res.json({
    success: true,
    data: user.alerts
  });
}));

// Create alert
router.post('/alerts', authenticate, asyncHandler(async (req, res) => {
  const { name, type, config, channels } = req.body;

  if (!type) {
    throw new ValidationError([{ field: 'type', message: 'Alert type is required' }]);
  }

  const alert = {
    name: name || `${type} Alert`,
    type,
    config: config || {},
    channels: channels || { email: true, inApp: true },
    active: true,
    createdAt: new Date()
  };

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $push: { alerts: alert } },
    { new: true }
  ).select('alerts');

  res.status(201).json({
    success: true,
    data: user.alerts[user.alerts.length - 1]
  });
}));

// Update alert
router.put('/alerts/:alertId', authenticate, asyncHandler(async (req, res) => {
  const { alertId } = req.params;
  const { name, config, channels, active } = req.body;

  const updates = {};
  if (name !== undefined) updates['alerts.$.name'] = name;
  if (config !== undefined) updates['alerts.$.config'] = config;
  if (channels !== undefined) updates['alerts.$.channels'] = channels;
  if (active !== undefined) updates['alerts.$.active'] = active;

  const user = await User.findOneAndUpdate(
    { _id: req.user._id, 'alerts._id': alertId },
    { $set: updates },
    { new: true }
  ).select('alerts');

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found'
    });
  }

  const updatedAlert = user.alerts.find(a => a._id.toString() === alertId);

  res.json({
    success: true,
    data: updatedAlert
  });
}));

// Delete alert
router.delete('/alerts/:alertId', authenticate, asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $pull: { alerts: { _id: req.params.alertId } }
  });

  res.json({
    success: true,
    message: 'Alert deleted'
  });
}));

// Get integrations
router.get('/integrations', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('integrations');

  // Mask webhook URLs
  const integrations = { ...user.integrations.toObject() };
  if (integrations.slack?.webhookUrl) {
    integrations.slack.webhookUrl = '***configured***';
  }
  if (integrations.teams?.webhookUrl) {
    integrations.teams.webhookUrl = '***configured***';
  }
  if (integrations.customWebhook?.url) {
    integrations.customWebhook.url = '***configured***';
  }

  res.json({
    success: true,
    data: integrations
  });
}));

// Update integration
router.put('/integrations/:type', authenticate, asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { webhookUrl, channel, headers, enabled } = req.body;

  if (!['slack', 'teams', 'customWebhook'].includes(type)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid integration type'
    });
  }

  const updates = {};
  if (webhookUrl !== undefined) updates[`integrations.${type}.webhookUrl`] = webhookUrl;
  if (channel !== undefined) updates[`integrations.${type}.channel`] = channel;
  if (headers !== undefined) updates[`integrations.${type}.headers`] = headers;
  if (enabled !== undefined) updates[`integrations.${type}.enabled`] = enabled;

  if (type === 'customWebhook' && webhookUrl !== undefined) {
    updates[`integrations.${type}.url`] = webhookUrl;
  }

  await User.findByIdAndUpdate(req.user._id, { $set: updates });

  res.json({
    success: true,
    message: 'Integration updated'
  });
}));

// Test integration
router.post('/integrations/:type/test', authenticate, asyncHandler(async (req, res) => {
  const { type } = req.params;
  const user = await User.findById(req.user._id).select('integrations');

  const integration = user.integrations[type];
  if (!integration?.webhookUrl && !integration?.url) {
    return res.status(400).json({
      success: false,
      error: 'Integration not configured'
    });
  }

  try {
    const axios = (await import('axios')).default;
    const webhookUrl = integration.webhookUrl || integration.url;

    const testMessage = {
      text: 'RegWatch Test Notification',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*RegWatch Integration Test*\nYour integration is working correctly!'
          }
        }
      ]
    };

    await axios.post(webhookUrl, testMessage, {
      headers: integration.headers || {},
      timeout: 5000
    });

    res.json({
      success: true,
      message: 'Test notification sent'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to send test notification',
      details: error.message
    });
  }
}));

// Generate API key
router.post('/api-key', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user.canAccess('api-access')) {
    return res.status(403).json({
      success: false,
      error: 'API access requires a Pro or Enterprise subscription'
    });
  }

  const apiKey = user.generateApiKey();
  user.apiAccess.enabled = true;
  await user.save();

  res.json({
    success: true,
    data: {
      apiKey,
      message: 'Store this key securely. It will not be shown again.'
    }
  });
}));

// Revoke API key
router.delete('/api-key', authenticate, asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $set: {
      'apiAccess.enabled': false,
      'apiAccess.apiKey': null,
      'apiAccess.apiKeyHash': null
    }
  });

  res.json({
    success: true,
    message: 'API key revoked'
  });
}));

// Get recently viewed items
router.get('/recently-viewed', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('recentlyViewed')
    .populate({
      path: 'recentlyViewed.itemId',
      select: 'title name summary'
    });

  // Sort by most recent and limit
  const recentlyViewed = user.recentlyViewed
    .filter(rv => rv.itemId) // Filter out deleted items
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, 20);

  res.json({
    success: true,
    data: recentlyViewed
  });
}));

// Clear recently viewed
router.delete('/recently-viewed', authenticate, asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $set: { recentlyViewed: [] }
  });

  res.json({
    success: true,
    message: 'History cleared'
  });
}));

// Export user data (GDPR right to portability)
router.get('/export', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('preferences.watchedRegulations', 'name acronym')
    .populate('savedUpdates.update', 'title sourceUrl');

  // Remove sensitive fields
  const exportData = user.toJSON();
  delete exportData.passwordHash;
  delete exportData.verification;
  delete exportData.passwordReset;
  delete exportData.twoFactor;
  delete exportData.apiAccess;
  delete exportData.loginHistory;

  res.json({
    success: true,
    data: exportData,
    exportedAt: new Date().toISOString()
  });
}));

// Delete account (GDPR right to erasure)
router.delete('/account', authenticate, asyncHandler(async (req, res) => {
  const { confirmation } = req.body;

  if (confirmation !== 'DELETE MY ACCOUNT') {
    return res.status(400).json({
      success: false,
      error: 'Please confirm by typing "DELETE MY ACCOUNT"'
    });
  }

  // Soft delete - mark as deleted
  await User.findByIdAndUpdate(req.user._id, {
    status: 'deleted',
    email: `deleted_${req.user._id}@deleted.local`,
    name: 'Deleted User',
    preferences: {},
    alerts: [],
    savedSearches: [],
    savedUpdates: [],
    integrations: {}
  });

  res.json({
    success: true,
    message: 'Account deleted'
  });
}));

export default router;
