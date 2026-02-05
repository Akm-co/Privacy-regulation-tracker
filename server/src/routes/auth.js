import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { User } from '../models/index.js';
import { authenticate, generateTokens } from '../middleware/auth.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, ValidationError, UnauthorizedError, ConflictError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

const router = Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty().withMessage('Name is required')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// Register
router.post('/register', authLimiter, registerValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(e => ({
      field: e.path,
      message: e.msg
    })));
  }

  const { email, password, name, organization } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ConflictError('Email already registered');
  }

  // Create user
  const user = await User.create({
    email,
    passwordHash: password, // Will be hashed by pre-save hook
    name,
    organization,
    verification: {
      emailVerificationToken: crypto.randomBytes(32).toString('hex'),
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  // TODO: Send verification email

  logger.info(`New user registered: ${email}`);

  res.status(201).json({
    success: true,
    data: {
      user: user.toJSON(),
      accessToken,
      refreshToken
    }
  });
}));

// Login
router.post('/login', authLimiter, loginValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(e => ({
      field: e.path,
      message: e.msg
    })));
  }

  const { email, password } = req.body;

  // Find user with password
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // Check status
  if (user.status !== 'active') {
    throw new UnauthorizedError('Account is suspended');
  }

  // Compare password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    // Log failed attempt
    user.loginHistory.push({
      date: new Date(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: false
    });
    await user.save();

    throw new UnauthorizedError('Invalid credentials');
  }

  // Log successful login
  user.lastLogin = new Date();
  user.loginHistory.push({
    date: new Date(),
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    success: true
  });

  // Keep only last 10 login attempts
  if (user.loginHistory.length > 10) {
    user.loginHistory = user.loginHistory.slice(-10);
  }

  await user.save();

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  logger.info(`User logged in: ${email}`);

  res.json({
    success: true,
    data: {
      user: user.toJSON(),
      accessToken,
      refreshToken
    }
  });
}));

// Refresh token
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new UnauthorizedError('Refresh token required');
  }

  try {
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(refreshToken, process.env.JWT_SECRET);

    if (decoded.type !== 'refresh') {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedError('User not found or inactive');
    }

    const tokens = generateTokens(user._id);

    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
}));

// Get current user
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('preferences.watchedRegulations', 'name acronym');

  res.json({
    success: true,
    data: user
  });
}));

// Update profile
router.put('/me', authenticate, asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'organization', 'jobTitle', 'industry'];
  const updates = {};

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    data: user
  });
}));

// Change password
router.put('/password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ValidationError([
      { field: 'currentPassword', message: 'Current password is required' },
      { field: 'newPassword', message: 'New password is required' }
    ]);
  }

  if (newPassword.length < 8) {
    throw new ValidationError([
      { field: 'newPassword', message: 'New password must be at least 8 characters' }
    ]);
  }

  const user = await User.findById(req.user._id).select('+passwordHash');
  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  user.passwordHash = newPassword; // Will be hashed by pre-save hook
  await user.save();

  logger.info(`Password changed for user: ${user.email}`);

  res.json({
    success: true,
    message: 'Password updated successfully'
  });
}));

// Request password reset
router.post('/forgot-password', passwordResetLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({
      success: true,
      message: 'If an account exists, a password reset email has been sent'
    });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.passwordReset = {
    token: crypto.createHash('sha256').update(resetToken).digest('hex'),
    expires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  };

  await user.save();

  // TODO: Send password reset email

  logger.info(`Password reset requested for: ${email}`);

  res.json({
    success: true,
    message: 'If an account exists, a password reset email has been sent'
  });
}));

// Reset password
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    throw new ValidationError([
      { field: 'token', message: 'Reset token is required' },
      { field: 'newPassword', message: 'New password is required' }
    ]);
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    'passwordReset.token': hashedToken,
    'passwordReset.expires': { $gt: Date.now() }
  });

  if (!user) {
    throw new UnauthorizedError('Invalid or expired reset token');
  }

  user.passwordHash = newPassword;
  user.passwordReset = undefined;
  await user.save();

  logger.info(`Password reset completed for: ${user.email}`);

  res.json({
    success: true,
    message: 'Password has been reset'
  });
}));

// Verify email
router.get('/verify-email/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({
    'verification.emailVerificationToken': token,
    'verification.emailVerificationExpires': { $gt: Date.now() }
  });

  if (!user) {
    throw new UnauthorizedError('Invalid or expired verification token');
  }

  user.verification.emailVerified = true;
  user.verification.emailVerificationToken = undefined;
  user.verification.emailVerificationExpires = undefined;
  await user.save();

  logger.info(`Email verified for: ${user.email}`);

  res.json({
    success: true,
    message: 'Email verified successfully'
  });
}));

export default router;
