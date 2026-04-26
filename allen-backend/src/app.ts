import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { logger } from './config/logger';
import { generalLimiter, authLimiter } from './middleware/rateLimiter';
import { healthCheck } from './db/connection';
import { getMigrationStatus } from './db/migrations';

// Import routes
import authRoutes from './routes/auth';
import protectedRoutes from './routes/protected';
import itemsRoutes from './routes/items';
import syncRoutes from './routes/sync';

// ─── Initialize Express ────────────────────────────────────────────────────

const app: Express = express();

// ─── Trust proxy (needed for correct IP behind load balancer / nginx) ──────

app.set('trust proxy', 1);

// ─── CORS ─────────────────────────────────────────────────────────────────
// Mobile app requests don't carry an Origin header, so we allow those
// unconditionally. Browser clients are restricted to CORS_ORIGIN.

const { origins } = config.cors;

app.use(cors({
  origin: origins.length > 0
    ? (origin, callback) => {
        // No origin = native mobile / curl / Postman — always allow
        if (!origin || origins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn('CORS rejected', { origin });
          // Pass null as first arg so cors sends a 403, not a 500
          callback(null, false);
        }
      }
    : true,
  credentials: true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
  maxAge: 86400, // cache preflight for 24 h
}));

// ─── Body parsers ──────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── HTTP request logging (all environments) ──────────────────────────────

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'http';

    logger.log(level, `${req.method} ${req.path}`, {
      status: res.statusCode,
      ms,
      ip: req.ip,
    });
  });

  next();
});

// ─── Rate limiting ────────────────────────────────────────────────────────

app.use(generalLimiter);

// ─── Routes ────────────────────────────────────────────────────────────────

app.get('/health', async (_req: Request, res: Response) => {
  const db = await healthCheck();

  res.json({
    status: db.status === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: config.nodeEnv,
    database: db,
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Allen GTD API',
    version: '1.0.0',
    endpoints: {
      health:     '/health',
      migrations: '/migrations',
      auth:       '/api/v1/auth',
      items:      '/api/items',
      sync:       '/api/sync',
    },
  });
});

app.get('/migrations', async (_req: Request, res: Response) => {
  try {
    const status = await getMigrationStatus();
    res.json(status);
  } catch (error) {
    logger.error('Failed to get migration status', { error });
    res.status(500).json({ error: 'Failed to get migration status' });
  }
});

// ─── API routes ────────────────────────────────────────────────────────────

// Auth routes get the strict limiter in addition to the general one
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/auth', authLimiter, protectedRoutes);
app.use('/api/items',  itemsRoutes);
app.use('/api/sync',   syncRoutes);

app.get('/api/v1', (_req: Request, res: Response) => {
  res.json({
    message: 'Allen GTD API v1',
    status:  'ready',
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error:   'Not Found',
    message: `${req.method} ${req.path} not found`,
  });
});

// ─── Global error handler ─────────────────────────────────────────────────

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack:   config.isProd ? undefined : err.stack,
    method:  req.method,
    path:    req.path,
  });

  res.status(500).json({
    error:   'Internal Server Error',
    message: config.isProd ? 'An unexpected error occurred' : err.message,
  });
});

export default app;
