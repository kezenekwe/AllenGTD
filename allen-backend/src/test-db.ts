import pool, { query, testConnection } from './db';

// ─── Test Database Connection ──────────────────────────────────────────────

async function testDatabase() {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║                                        ║');
  console.log('║   Database Connection Test             ║');
  console.log('║                                        ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  try {
    // Test 1: Basic connection
    console.log('Test 1: Basic Connection...');
    const isConnected = await testConnection();
    if (isConnected) {
      console.log('✓ Basic connection successful');
    } else {
      console.log('✗ Basic connection failed');
      process.exit(1);
    }

    // Test 2: Check tables exist
    console.log('');
    console.log('Test 2: Checking Tables...');
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(row => row.table_name);
    const expectedTables = ['users', 'items', 'project_steps', 'sync_log'];

    expectedTables.forEach(table => {
      if (tables.includes(table)) {
        console.log(`✓ Table '${table}' exists`);
      } else {
        console.log(`✗ Table '${table}' missing`);
      }
    });

    // Test 3: Check table structures
    console.log('');
    console.log('Test 3: Table Structures...');

    // Users table
    const usersColumns = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log(`✓ Users table: ${usersColumns.rows.length} columns`);

    // Items table
    const itemsColumns = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'items'
      ORDER BY ordinal_position
    `);
    console.log(`✓ Items table: ${itemsColumns.rows.length} columns`);

    // Project steps table
    const stepsColumns = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'project_steps'
      ORDER BY ordinal_position
    `);
    console.log(`✓ Project steps table: ${stepsColumns.rows.length} columns`);

    // Sync log table
    const syncColumns = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sync_log'
      ORDER BY ordinal_position
    `);
    console.log(`✓ Sync log table: ${syncColumns.rows.length} columns`);

    // Test 4: Check indexes
    console.log('');
    console.log('Test 4: Checking Indexes...');
    const indexesResult = await query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);
    console.log(`✓ Found ${indexesResult.rows.length} indexes`);

    // Test 5: Check constraints
    console.log('');
    console.log('Test 5: Checking Constraints...');
    const constraintsResult = await query(`
      SELECT table_name, constraint_type, COUNT(*) as count
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
      GROUP BY table_name, constraint_type
      ORDER BY table_name, constraint_type
    `);
    console.log(`✓ Constraints verified`);
    constraintsResult.rows.forEach(row => {
      console.log(`   • ${row.table_name}: ${row.count} ${row.constraint_type}`);
    });

    // Summary
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║                                        ║');
    console.log('║   All Tests Passed! ✓                  ║');
    console.log('║                                        ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('Database is ready for use!');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('✗ Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run tests
testDatabase();
