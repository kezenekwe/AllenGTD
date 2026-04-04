import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ─── Database Configuration ────────────────────────────────────────────────

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'allen_gtd',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

// ─── Create Connection Pool ────────────────────────────────────────────────

const pool = new Pool(poolConfig);

// ─── Connection Event Handlers ─────────────────────────────────────────────

pool.on('connect', () => {
  console.log('✓ New database connection established');
});

pool.on('acquire', () => {
  // Optional: Log when a client is acquired from pool
  // console.log('Client acquired from pool');
});

pool.on('remove', () => {
  console.log('⚠ Database connection removed from pool');
});

pool.on('error', (err) => {
  console.error('✗ Unexpected database pool error:', err);
  // Don't exit process - pool will handle reconnection
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
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Query executed:', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: res.rowCount,
      });
    }
    
    return res;
  } catch (error) {
    console.error('Query error:', {
      text: text.substring(0, 100),
      error: error instanceof Error ? error.message : error,
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
    const { now, db } = res.rows[0];
    console.log(`✓ Database connection successful`);
    console.log(`  Database: ${db}`);
    console.log(`  Time: ${new Date(now).toISOString()}`);
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error);
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
  console.log('Closing database connection pool...');
  await pool.end();
  console.log('✓ Database connections closed');
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
