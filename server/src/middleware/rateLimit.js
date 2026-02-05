import rateLimit from 'express-rate-limit';
import { getRedisClient } from '../config/redis.js';
import { logger } from '../utils/logger.js';

// Generic rate limiter
export const createRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
    max: options.max || 100, // 100 requests per window default
    message: {
      success: false,
      error: 'Too many requests, please try again later.',
      retryAfter: Math.ceil((options.windowMs || 15 * 60 * 1000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      return req.user?.id || req.ip;
    },
    skip: (req) => {
      // Skip rate limiting for admin users
      return req.user?.role === 'admin';
    },
    ...options
  });
};

// Standard API rate limiter - higher limits for development
const isDev = process.env.NODE_ENV !== 'production';
export const apiLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: isDev ? 1000 : (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100),
  skip: () => isDev // Skip rate limiting entirely in development
});

// Strict limiter for auth routes
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again after 15 minutes.'
  }
});

// Strict limiter for password reset
export const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts
  message: {
    success: false,
    error: 'Too many password reset attempts, please try again after an hour.'
  }
});

// Generous limiter for search
export const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30 // 30 searches per minute
});

// AI chat limiter
export const chatLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 messages per hour for free users
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => {
    // Pro and enterprise users have higher limits
    return req.user?.role === 'pro' || req.user?.role === 'enterprise';
  }
});

// Pro user chat limiter
export const proChatLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 200 // 200 messages per hour for pro users
});

// Report generation limiter
export const reportLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 reports per hour
  message: {
    success: false,
    error: 'Report generation limit reached. Please try again later.'
  }
});

// Export limiter
export const exportLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20 // 20 exports per hour
});

// Scraping API limiter (internal use)
export const scrapingLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60 // 60 requests per minute to external sources
});

// Custom Redis-based rate limiter for more accurate tracking
export class RedisRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60 * 1000;
    this.max = options.max || 100;
    this.prefix = options.prefix || 'rl:';
  }

  async isAllowed(key) {
    try {
      const redis = getRedisClient();
      if (!redis) {
        // If Redis is not available, allow the request
        return { allowed: true, remaining: this.max };
      }

      const fullKey = `${this.prefix}${key}`;
      const current = await redis.incr(fullKey);

      if (current === 1) {
        await redis.pExpire(fullKey, this.windowMs);
      }

      const remaining = Math.max(0, this.max - current);
      const allowed = current <= this.max;

      return {
        allowed,
        remaining,
        total: this.max,
        resetTime: Date.now() + this.windowMs
      };
    } catch (error) {
      logger.error('Redis rate limiter error:', error);
      return { allowed: true, remaining: this.max };
    }
  }

  middleware() {
    return async (req, res, next) => {
      const key = req.user?.id || req.ip;
      const result = await this.isAllowed(key);

      res.setHeader('X-RateLimit-Limit', this.max);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetTime);

      if (!result.allowed) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil(this.windowMs / 1000)
        });
      }

      next();
    };
  }
}
