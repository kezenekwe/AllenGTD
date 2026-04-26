import rateLimit from 'express-rate-limit';
import { config } from '../config/env';

const tooManyRequests = (message: string) => ({
  error: 'Too Many Requests',
  message,
  retryAfter: '15 minutes',
});

// ─── General API limiter — applied globally ───────────────────────────────
// 1000 req / 15 min per IP (default). Configurable via RATE_LIMIT_GENERAL.

export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.general.windowMs,
  max:      config.rateLimit.general.max,
  standardHeaders: true,  // Return RateLimit-* headers (RFC 6585)
  legacyHeaders:   false, // Disable X-RateLimit-* headers
  message: tooManyRequests('Too many requests. Please slow down.'),
});

// ─── Auth limiter — applied to /auth/login and /auth/register ────────────
// 20 req / 15 min per IP (default). Configurable via RATE_LIMIT_AUTH.

export const authLimiter = rateLimit({
  windowMs: config.rateLimit.auth.windowMs,
  max:      config.rateLimit.auth.max,
  standardHeaders: true,
  legacyHeaders:   false,
  message: tooManyRequests(
    'Too many authentication attempts. Please wait before trying again.'
  ),
  // Skip successful requests so only failed attempts count
  skipSuccessfulRequests: true,
});
