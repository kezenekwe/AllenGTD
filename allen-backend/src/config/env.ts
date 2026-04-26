import dotenv from 'dotenv';

dotenv.config();

// ─── Helpers ──────────────────────────────────────────────────────────────

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function optionalInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (isNaN(n)) throw new Error(`Environment variable ${key} must be an integer, got: ${raw}`);
  return n;
}

// ─── Build config ─────────────────────────────────────────────────────────

const nodeEnv    = optional('NODE_ENV', 'development');
const isProd     = nodeEnv === 'production';
const jwtSecret  = required('JWT_SECRET');
const databaseUrl = process.env.DATABASE_URL; // set by Render / Railway / Heroku

if (isProd && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

// When DATABASE_URL is provided (cloud deploys), individual DB_* vars are optional.
// When it is absent (local dev), DB_USER must be set explicitly.
if (!databaseUrl && !process.env.DB_USER) {
  throw new Error('Missing required env var: DB_USER (or provide DATABASE_URL)');
}

const rawOrigins = optional('CORS_ORIGIN', '');
const corsOrigins = rawOrigins
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (isProd && corsOrigins.length === 0) {
  // Warn but don't hard-fail — mobile apps don't send Origin headers
  console.warn('[config] CORS_ORIGIN not set in production. All origins will be allowed.');
}

// ─── Exported config ──────────────────────────────────────────────────────

export const config = {
  port: optionalInt('PORT', 3000),
  nodeEnv,
  isProd,

  db: {
    url:      databaseUrl,
    host:     optional('DB_HOST', 'localhost'),
    port:     optionalInt('DB_PORT', 5432),
    name:     optional('DB_NAME', 'allen_gtd'),
    user:     optional('DB_USER', ''),
    password: process.env.DB_PASSWORD,
    ssl:      process.env.DB_SSL === 'true',
  },

  jwt: {
    secret:    jwtSecret,
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
  },

  cors: {
    origins: corsOrigins,
  },

  rateLimit: {
    general: {
      windowMs: 15 * 60 * 1000,
      max:      optionalInt('RATE_LIMIT_GENERAL', 1000),
    },
    auth: {
      windowMs: 15 * 60 * 1000,
      max:      optionalInt('RATE_LIMIT_AUTH', 20),
    },
  },

  log: {
    level: optional('LOG_LEVEL', isProd ? 'info' : 'debug'),
  },
} as const;
