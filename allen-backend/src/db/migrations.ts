import fs from 'fs';
import path from 'path';
import { query, transaction } from './connection';
import { PoolClient } from 'pg';

// ─── Migration Types ───────────────────────────────────────────────────────

interface Migration {
  id: number;
  name: string;
  filename: string;
  sql: string;
}

interface MigrationRecord {
  id: number;
  name: string;
  executed_at: Date;
}

// ─── Create Migrations Table ───────────────────────────────────────────────

async function createMigrationsTable(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  await query(sql);
}

// ─── Get Executed Migrations ───────────────────────────────────────────────

async function getExecutedMigrations(): Promise<MigrationRecord[]> {
  try {
    const result = await query(
      'SELECT id, name, executed_at FROM migrations ORDER BY id'
    );
    return result.rows;
  } catch (error) {
    // Table might not exist yet
    return [];
  }
}

// ─── Load Migration Files ──────────────────────────────────────────────────

function loadMigrationFiles(migrationsDir: string): Migration[] {
  if (!fs.existsSync(migrationsDir)) {
    console.log(`⚠ Migrations directory not found: ${migrationsDir}`);
    return [];
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Alphabetical order ensures correct execution

  return files.map((filename, index) => {
    const filePath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');
    
    // Extract migration name from filename (e.g., "001_initial_schema.sql" -> "initial_schema")
    const name = filename.replace(/^\d+_/, '').replace(/\.sql$/, '');
    
    return {
      id: index + 1,
      name,
      filename,
      sql,
    };
  });
}

// ─── Execute Single Migration ──────────────────────────────────────────────

async function executeMigration(
  client: PoolClient,
  migration: Migration
): Promise<void> {
  console.log(`   Running: ${migration.filename}`);
  
  // Execute the migration SQL
  await client.query(migration.sql);
  
  // Record the migration as executed
  await client.query(
    'INSERT INTO migrations (name) VALUES ($1)',
    [migration.name]
  );
  
  console.log(`   ✓ ${migration.filename} completed`);
}

// ─── Run Pending Migrations ────────────────────────────────────────────────

export async function runMigrations(
  migrationsDir: string = path.join(process.cwd(), 'migrations')
): Promise<void> {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║                                        ║');
  console.log('║   Database Migrations                  ║');
  console.log('║                                        ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  try {
    // Ensure migrations table exists
    await createMigrationsTable();
    console.log('✓ Migrations table ready');

    // Get already executed migrations
    const executed = await getExecutedMigrations();
    const executedNames = new Set(executed.map(m => m.name));
    
    if (executed.length > 0) {
      console.log(`✓ Found ${executed.length} previously executed migration(s)`);
    }

    // Load migration files
    const migrations = loadMigrationFiles(migrationsDir);
    
    if (migrations.length === 0) {
      console.log('⚠ No migration files found');
      console.log('');
      return;
    }

    console.log(`✓ Found ${migrations.length} migration file(s)`);

    // Filter pending migrations
    const pending = migrations.filter(m => !executedNames.has(m.name));

    if (pending.length === 0) {
      console.log('✓ All migrations up to date');
      console.log('');
      return;
    }

    console.log('');
    console.log(`🔄 Running ${pending.length} pending migration(s)...`);
    console.log('');

    // Execute each pending migration in a transaction
    for (const migration of pending) {
      await transaction(async (client) => {
        await executeMigration(client, migration);
      });
    }

    console.log('');
    console.log('✓ All migrations completed successfully');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('✗ Migration failed:', error);
    console.error('');
    throw error;
  }
}

// ─── Get Migration Status ──────────────────────────────────────────────────

export async function getMigrationStatus(
  migrationsDir: string = path.join(process.cwd(), 'migrations')
): Promise<{
  total: number;
  executed: number;
  pending: number;
  migrations: Array<{
    name: string;
    status: 'executed' | 'pending';
    executedAt?: Date;
  }>;
}> {
  const executed = await getExecutedMigrations();
  const executedMap = new Map(executed.map(m => [m.name, m]));
  
  const migrations = loadMigrationFiles(migrationsDir);
  
  return {
    total: migrations.length,
    executed: executed.length,
    pending: migrations.length - executed.length,
    migrations: migrations.map(m => ({
      name: m.name,
      status: executedMap.has(m.name) ? 'executed' : 'pending',
      executedAt: executedMap.get(m.name)?.executed_at,
    })),
  };
}

// ─── Rollback Last Migration (Advanced - Use with Caution) ────────────────

export async function rollbackLastMigration(): Promise<void> {
  console.warn('⚠ Rollback not implemented - manual intervention required');
  console.warn('  Rollback migrations manually using psql or migration down scripts');
  throw new Error('Rollback not implemented');
}
