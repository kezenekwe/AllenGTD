import dotenv from 'dotenv';
import { testConnection, closePool } from './db/connection';
import { runMigrations } from './db/migrations';
import app from './app';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

// ─── Database Initialization ───────────────────────────────────────────────

async function initializeDatabase() {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║                                        ║');
  console.log('║   Database Migrations                  ║');
  console.log('║                                        ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  const connected = await testConnection();
  if (!connected) {
    console.error('✗ Cannot start server - database connection failed');
    process.exit(1);
  }

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
    await initializeDatabase();

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
      console.log('');
      console.log('📍 Endpoints:');
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   API Info: http://localhost:${PORT}/api/v1`);
      console.log(`   Register: POST http://localhost:${PORT}/api/v1/auth/register`);
      console.log(`   Login: POST http://localhost:${PORT}/api/v1/auth/login`);
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

startServer();
