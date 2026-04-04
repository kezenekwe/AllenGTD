import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, healthCheck, closePool } from './db/connection';
import { runMigrations, getMigrationStatus } from './db/migrations';

// Load environment variables
dotenv.config();

// ─── Initialize Express ────────────────────────────────────────────────────

const app: Express = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ────────────────────────────────────────────────────────────────

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const dbHealth = await healthCheck();
  
  res.json({
    status: dbHealth.status === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: dbHealth,
  });
});

// API info endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Allen GTD API',
    version: '1.0.0',
    description: 'Backend API for Allen GTD mobile app',
    endpoints: {
      health: '/health',
      migrations: '/migrations',
      api: '/api/v1',
    },
  });
});

// Migrations status endpoint
app.get('/migrations', async (req: Request, res: Response) => {
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

// API v1 routes (placeholder)
app.get('/api/v1', (req: Request, res: Response) => {
  res.json({
    message: 'Allen GTD API v1',
    status: 'ready',
    routes: {
      auth: '/api/v1/auth',
      items: '/api/v1/items',
      sync: '/api/v1/sync',
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
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// ─── Database Initialization ───────────────────────────────────────────────

async function initializeDatabase() {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║                                        ║');
  console.log('║   Initializing Database                ║');
  console.log('║                                        ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  // Test connection
  const connected = await testConnection();
  if (!connected) {
    console.error('✗ Cannot start server - database connection failed');
    process.exit(1);
  }

  // Run migrations
  try {
    await runMigrations();
  } catch (error) {
    console.error('✗ Cannot start server - migration failed');
    process.exit(1);
  }
}

// ─── Start Server ──────────────────────────────────────────────────────────

async function startServer() {
  try {
    // Initialize database first
    await initializeDatabase();

    // Start Express server
    app.listen(PORT, () => {
      console.log('');
      console.log('╔════════════════════════════════════════╗');
      console.log('║                                        ║');
      console.log('║       Allen GTD API Server             ║');
      console.log('║                                        ║');
      console.log('╚════════════════════════════════════════╝');
      console.log('');
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`📋 Migrations: http://localhost:${PORT}/migrations`);
      console.log('');
      console.log('Press Ctrl+C to stop');
      console.log('');
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ─────────────────────────────────────────────────────

process.on('SIGTERM', async () => {
  console.log('');
  console.log('⚠ SIGTERM received, shutting down gracefully...');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('');
  console.log('⚠ SIGINT received, shutting down gracefully...');
  await closePool();
  process.exit(0);
});

// Start the server
startServer();

export default app;
