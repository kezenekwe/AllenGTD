import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import {schema} from './schema';
import {migrations} from './migrations';
import Item from './models/Item';
import ProjectStep from './models/ProjectStep';

// ─── Adapter ───────────────────────────────────────────────────────────────
// SQLiteAdapter works on iOS and Android via native SQLite.

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true,                // Use JSI for better performance
  onSetUpError: error => {
    // DB failed to load — in production, show user a message
    console.error('Database setup error:', error);
  },
});

// ─── Database ──────────────────────────────────────────────────────────────

export const database = new Database({
  adapter,
  modelClasses: [Item, ProjectStep],
});

// Convenience collection accessors
export const itemsCollection = database.collections.get<Item>('items');
export const stepsCollection = database.collections.get<ProjectStep>('project_steps');
