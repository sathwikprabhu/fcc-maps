import rateLimit from 'express-rate-limit';

/**
 * Strict limiter for high-risk write operations (sync trigger, file upload).
 * 10 requests per 15 minutes per IP.
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

/**
 * Standard limiter for settings/colors writes.
 * 30 requests per 15 minutes per IP.
 */
export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

/**
 * Loose limiter for read endpoints (logs, status, export).
 * 120 requests per 15 minutes per IP.
 */
export const looseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
