import { testConnection, healthCheck } from './db/connection';
import { runMigrations, getMigrationStatus } from './db/migrations';

// ─── Test Database Connection and Migrations ───────────────────────────────

async function testDatabaseSetup() {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║                                        ║');
  console.log('║   Database Connection Test             ║');
  console.log('║                                        ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  let exitCode = 0;

  try {
    // Test 1: Basic connection
    console.log('Test 1: Testing basic connection...');
    const connected = await testConnection();
    
    if (!connected) {
      console.error('✗ Connection test failed');
      exitCode = 1;
      return;
    }
    console.log('');

    // Test 2: Health check
    console.log('Test 2: Running health check...');
    const health = await healthCheck();
    console.log('Health check result:');
    console.log('  Status:', health.status);
    console.log('  Database:', health.database);
    console.log('  Timestamp:', health.timestamp.toISOString());
    
    if (health.status !== 'ok') {
      console.error('✗ Health check failed:', health.error);
      exitCode = 1;
      return;
    }
    console.log('✓ Health check passed');
    console.log('');

    // Test 3: Run migrations
    console.log('Test 3: Running migrations...');
    await runMigrations();
    console.log('✓ Migrations completed');
    console.log('');

    // Test 4: Check migration status
    console.log('Test 4: Checking migration status...');
    const status = await getMigrationStatus();
    console.log('Migration status:');
    console.log('  Total migrations:', status.total);
    console.log('  Executed:', status.executed);
    console.log('  Pending:', status.pending);
    console.log('');
    
    if (status.migrations.length > 0) {
      console.log('  Migrations:');
      status.migrations.forEach((m) => {
        const statusIcon = m.status === 'executed' ? '✓' : '○';
        console.log(`    ${statusIcon} ${m.name} (${m.status})`);
      });
    }
    console.log('');

    // Summary
    console.log('╔════════════════════════════════════════╗');
    console.log('║                                        ║');
    console.log('║   All Tests Passed! ✓                  ║');
    console.log('║                                        ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('Database is ready! You can now:');
    console.log('  1. Start the server: npm run dev');
    console.log('  2. Test endpoints: curl http://localhost:3000/health');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('✗ Test failed:', error);
    console.error('');
    exitCode = 1;
  } finally {
    // Close database connections
    const { closePool } = await import('./db/connection');
    await closePool();
    process.exit(exitCode);
  }
}

// Run tests
testDatabaseSetup();
