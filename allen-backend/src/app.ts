import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthCheck } from './db/connection';
import { getMigrationStatus } from './db/migrations';

// Import routes
import authRoutes from './routes/auth';
import protectedRoutes from './routes/protected';
import itemsRoutes from './routes/items';
import syncRoutes from './routes/sync';

// Load environment variables
dotenv.config();

// ─── Initialize Express ────────────────────────────────────────────────────

const app: Express = express();

// ─── Middleware ────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ─── Routes ────────────────────────────────────────────────────────────────

app.get('/health', async (_req: Request, res: Response) => {
  const dbHealth = await healthCheck();

  res.json({
    status: dbHealth.status === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: dbHealth,
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Allen GTD API',
    version: '1.0.0',
    description: 'Backend API for Allen GTD mobile app',
    endpoints: {
      health: '/health',
      migrations: '/migrations',
      auth: '/api/v1/auth',
      items: '/api/v1/items',
      sync: '/api/v1/sync',
    },
  });
});

app.get('/migrations', async (_req: Request, res: Response) => {
  try {
    const status = await getMigrationStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get migration status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ─── API Routes ────────────────────────────────────────────────────────────

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth', protectedRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/sync', syncRoutes);

app.get('/api/v1', (_req: Request, res: Response) => {
  res.json({
    message: 'Allen GTD API v1',
    status: 'ready',
    routes: {
      auth: {
        register: 'POST /api/v1/auth/register',
        login: 'POST /api/v1/auth/login',
        me: 'GET /api/v1/auth/me (requires auth)',
        logout: 'POST /api/v1/auth/logout (requires auth)',
      },
      items: '/api/v1/items (coming soon)',
      sync: '/api/v1/sync (coming soon)',
    },
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

export default app;
