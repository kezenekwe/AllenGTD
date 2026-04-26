import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';
import dotenv from 'dotenv';
import { createLogger, format, transports } from 'winston';

dotenv.config();

// Lightweight local logger — avoids a circular dependency on config/logger
const log = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production'
    ? format.combine(format.timestamp(), format.json())
    : format.combine(format.colorize(), format.simple()),
  transports: [new transports.Console()],
});

// ─── Database Configuration ────────────────────────────────────────────────
// Prefer DATABASE_URL (provided by Render, Railway, Heroku, etc.).
// Fall back to individual vars for local development.

const BASE_POOL = {
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

const poolConfig: PoolConfig = process.env.DATABASE_URL
  ? {
      ...BASE_POOL,
      connectionString: process.env.DATABASE_URL,
      // Render's managed Postgres uses TLS with a self-signed cert internally
      ssl: { rejectUnauthorized: false },
    }
  : {
      ...BASE_POOL,
      host:     process.env.DB_HOST || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME  || 'allen_gtd',
      user:     process.env.DB_USER  || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

// ─── Create Connection Pool ────────────────────────────────────────────────

const pool = new Pool(poolConfig);

// ─── Connection Event Handlers ─────────────────────────────────────────────

pool.on('connect', () => {
  log.debug('DB pool: new connection established');
});

pool.on('remove', () => {
  log.debug('DB pool: connection removed');
});

pool.on('error', (err) => {
  log.error('DB pool: unexpected error', { message: err.message });
});

// ─── Query Helper Functions ────────────────────────────────────────────────

/**
 * Execute a single query
 */
export async function query(
  text: string,
  params?: any[]
): Promise<QueryResult> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    log.debug('query', {
      text: text.substring(0, 100) + (text.length > 100 ? '…' : ''),
      ms: duration,
      rows: res.rowCount,
    });

    return res;
  } catch (error) {
    log.error('query error', {
      text:    text.substring(0, 100),
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  return client;
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const res = await query('SELECT NOW() as now, current_database() as db');
    const { db } = res.rows[0];
    log.info('Database connection OK', { database: db });
    return true;
  } catch (error) {
    log.error('Database connection failed', { message: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/**
 * Check if database is ready
 */
export async function healthCheck(): Promise<{
  status: 'ok' | 'error';
  database: string;
  timestamp: Date;
  error?: string;
}> {
  try {
    const res = await query('SELECT NOW() as now, current_database() as db');
    const { now, db } = res.rows[0];
    
    return {
      status: 'ok',
      database: db,
      timestamp: new Date(now),
    };
  } catch (error) {
    return {
      status: 'error',
      database: process.env.DB_NAME || 'unknown',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gracefully close all connections
 */
export async function closePool(): Promise<void> {
  log.info('Closing database connection pool…');
  await pool.end();
  log.info('Database connections closed');
}

// ─── Graceful Shutdown ─────────────────────────────────────────────────────

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

// ─── Export Pool ───────────────────────────────────────────────────────────

export default pool;
