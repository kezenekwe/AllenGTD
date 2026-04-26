import { config } from './config/env';
import { logger } from './config/logger';
import { testConnection, closePool } from './db/connection';
import { runMigrations } from './db/migrations';
import app from './app';

const { port, nodeEnv, isProd } = config;

// ─── Database Initialization ───────────────────────────────────────────────

async function initializeDatabase(): Promise<void> {
  logger.info('Connecting to database…');

  const connected = await testConnection();
  if (!connected) {
    logger.error('Database connection failed — cannot start server');
    process.exit(1);
  }

  try {
    await runMigrations();
  } catch (error) {
    logger.error('Migration failed — cannot start server', { error });
    process.exit(1);
  }
}

// ─── Start Server ──────────────────────────────────────────────────────────

async function startServer(): Promise<void> {
  try {
    await initializeDatabase();

    app.listen(port, () => {
      logger.info(`Allen GTD API started`, {
        url:         `http://localhost:${port}`,
        environment: nodeEnv,
        pid:         process.pid,
      });

      if (!isProd) {
        logger.debug('Endpoints', {
          health: `http://localhost:${port}/health`,
          api:    `http://localhost:${port}/api/v1`,
          auth:   `POST http://localhost:${port}/api/v1/auth/register`,
        });
      }
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// ─── Graceful Shutdown ─────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully`);
  await closePool();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

startServer();
