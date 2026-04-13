// src/database/db.ts
// AsyncStorage-based local database for offline-first sync

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────

export interface LocalItem {
  id: string;
  serverId?: string | null;
  text: string;
  category: 'inbox' | 'nextActions' | 'projects' | 'waiting' | 'someday' | 'reference';
  status: 'active' | 'completed' | 'deleted';
  nextAction?: string | null;
  waitingFor?: string | null;
  projectPlan?: string | null;
  hasCalendar: boolean;
  createdAt: Date;
  updatedAt: Date;
  syncedAt?: Date | null;
  pendingDelete?: boolean;
}

const ITEMS_KEY = '@allen_gtd_items';

// ─── Low-level storage helpers ────────────────────────────────────────────

async function readAll(): Promise<LocalItem[]> {
  const raw = await AsyncStorage.getItem(ITEMS_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as any[];
  return parsed.map(item => ({
    ...item,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
    syncedAt: item.syncedAt ? new Date(item.syncedAt) : null,
  }));
}

async function writeAll(items: LocalItem[]): Promise<void> {
  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

// ─── db object (mirrors Dexie interface used in syncService) ──────────────

export const db = {
  items: {
    async toArray(): Promise<LocalItem[]> {
      return readAll();
    },

    async add(item: LocalItem): Promise<void> {
      const items = await readAll();
      items.push(item);
      await writeAll(items);
    },

    async put(item: LocalItem): Promise<void> {
      const items = await readAll();
      const idx = items.findIndex(i => i.id === item.id);
      if (idx >= 0) {
        items[idx] = item;
      } else {
        items.push(item);
      }
      await writeAll(items);
    },

    async update(id: string, changes: Partial<LocalItem>): Promise<void> {
      const items = await readAll();
      const idx = items.findIndex(i => i.id === id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...changes };
        await writeAll(items);
      }
    },

    async delete(id: string): Promise<void> {
      const items = await readAll();
      await writeAll(items.filter(i => i.id !== id));
    },

    async clear(): Promise<void> {
      await AsyncStorage.removeItem(ITEMS_KEY);
    },

    where(field: keyof LocalItem) {
      return {
        equals(value: any) {
          return {
            async toArray(): Promise<LocalItem[]> {
              const items = await readAll();
              return items.filter(item => {
                if (value === null) return item[field] == null;
                return item[field] === value;
              });
            },
            and(predicate: (item: LocalItem) => boolean) {
              return {
                async toArray(): Promise<LocalItem[]> {
                  const items = await readAll();
                  return items.filter(item => {
                    const matchesField = value === null
                      ? item[field] == null
                      : item[field] === value;
                    return matchesField && predicate(item);
                  });
                },
              };
            },
          };
        },
      };
    },
  },
};

// ─── Helper Functions ─────────────────────────────────────────────────────

export function generateLocalId(): string {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export async function createLocalItem(
  text: string,
  category: LocalItem['category']
): Promise<LocalItem> {
  const now = new Date();
  const item: LocalItem = {
    id: generateLocalId(),
    serverId: null,
    text,
    category,
    status: 'active',
    nextAction: null,
    waitingFor: null,
    projectPlan: null,
    hasCalendar: false,
    createdAt: now,
    updatedAt: now,
    syncedAt: null,
    pendingDelete: false,
  };
  await db.items.add(item);
  console.log('Created local item:', item.id);
  return item;
}

export async function updateLocalItem(
  itemId: string,
  updates: Partial<LocalItem>
): Promise<void> {
  await db.items.update(itemId, {
    ...updates,
    updatedAt: new Date(),
    syncedAt: null,
  });
  console.log('Updated local item:', itemId);
}

export async function getUnsyncedItems(): Promise<LocalItem[]> {
  const items = await readAll();
  return items.filter(item => item.syncedAt == null);
}

export async function getItemsByCategory(
  category: LocalItem['category']
): Promise<LocalItem[]> {
  const items = await readAll();
  return items.filter(item => item.category === category && item.status === 'active');
}

export async function getItemsByStatus(
  status: LocalItem['status']
): Promise<LocalItem[]> {
  const items = await readAll();
  return items.filter(item => item.status === status);
}

export async function countItemsByCategory(): Promise<Record<string, number>> {
  const items = await readAll();
  const counts: Record<string, number> = {
    inbox: 0, nextActions: 0, projects: 0,
    waiting: 0, someday: 0, reference: 0,
  };
  items
    .filter(item => item.status === 'active')
    .forEach(item => { counts[item.category] = (counts[item.category] || 0) + 1; });
  return counts;
}
