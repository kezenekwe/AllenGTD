// src/services/syncService.ts
// Enhanced sync service with conflict resolution (last-write-wins)

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { db } from '../database/db';
import { apiClient } from './apiClient';

// ─── Constants ────────────────────────────────────────────────────────────

const SYNC_TOKEN_KEY = 'lastSyncToken';
const LAST_PULL_TIME_KEY = 'lastPullTime';

// ─── Types ────────────────────────────────────────────────────────────────

interface LocalItem {
  id: string;
  serverId?: string | null;
  text: string;
  category: string;
  status: string;
  nextAction?: string | null;
  waitingFor?: string | null;
  projectPlan?: string | null;
  hasCalendar: boolean;
  createdAt: Date;
  updatedAt: Date;
  syncedAt?: Date | null;
  pendingDelete?: boolean;
}

interface ServerItem {
  id: string;
  user_id: string;
  text: string;
  category: string;
  status: string;
  next_action: string | null;
  waiting_for: string | null;
  project_plan: string | null;
  has_calendar: boolean;
  created_at: string;
  updated_at: string;
}

interface ConflictInfo {
  itemId: string;
  localVersion: LocalItem;
  remoteVersion: ServerItem;
  resolution: 'remote_wins' | 'local_wins';
  reason: string;
}

interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: ConflictInfo[];
  errors: string[];
}

// ─── Sync Service ─────────────────────────────────────────────────────────

class SyncService {
  private isSyncing = false;

  /**
   * Check if device is online
   */
  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  }

  /**
   * Full sync: Pull from server, then push local changes
   */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return {
        pushed: 0,
        pulled: 0,
        conflicts: [],
        errors: ['Sync already in progress'],
      };
    }

    const online = await this.isOnline();
    if (!online) {
      console.log('Device is offline, skipping sync');
      return {
        pushed: 0,
        pulled: 0,
        conflicts: [],
        errors: ['Device is offline'],
      };
    }

    this.isSyncing = true;

    try {
      console.log('Starting full sync with conflict resolution...');

      const conflicts: ConflictInfo[] = [];

      // 1. Pull changes from server (conflicts detected here)
      const pullResult = await this.pullChanges();
      conflicts.push(...pullResult.conflicts);

      // 2. Push local changes to server
      const pushed = await this.pushChanges();

      console.log(
        `Sync complete: Pulled ${pullResult.pulled}, Pushed ${pushed}, Conflicts: ${conflicts.length}`
      );

      return {
        pushed,
        pulled: pullResult.pulled,
        conflicts,
        errors: [],
      };
    } catch (error) {
      console.error('Sync error:', error);
      return {
        pushed: 0,
        pulled: 0,
        conflicts: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pull changes from server with conflict resolution
   */
  async pullChanges(): Promise<{
    pulled: number;
    conflicts: ConflictInfo[];
  }> {
    try {
      const lastSyncToken = await AsyncStorage.getItem(SYNC_TOKEN_KEY);

      console.log('Last sync token:', lastSyncToken || 'none (initial sync)');

      const url = lastSyncToken
        ? `/sync?since=${encodeURIComponent(lastSyncToken)}`
        : '/sync';

      const response = await apiClient.get(url);
      const { changes, syncToken, count } = response.data;

      console.log(`Pulled ${count} changes from server`);

      if (count === 0) {
        console.log('No changes to pull');

        if (syncToken) {
          await AsyncStorage.setItem(SYNC_TOKEN_KEY, syncToken);
          await AsyncStorage.setItem(LAST_PULL_TIME_KEY, new Date().toISOString());
        }

        return { pulled: 0, conflicts: [] };
      }

      const conflicts: ConflictInfo[] = [];
      let applied = 0;

      // Apply each change with conflict detection
      for (const serverItem of changes) {
        try {
          const conflictInfo = await this.applyServerChangeWithConflictResolution(
            serverItem
          );

          if (conflictInfo) {
            conflicts.push(conflictInfo);
          }

          applied++;
        } catch (error) {
          console.error(`Failed to apply change for item ${serverItem.id}:`, error);
        }
      }

      // Save new sync token
      if (syncToken) {
        await AsyncStorage.setItem(SYNC_TOKEN_KEY, syncToken);
        await AsyncStorage.setItem(LAST_PULL_TIME_KEY, new Date().toISOString());
        console.log('Updated sync token:', syncToken);
      }

      if (conflicts.length > 0) {
        console.log(`Resolved ${conflicts.length} conflicts`);
      }

      return { pulled: applied, conflicts };
    } catch (error) {
      console.error('Pull changes error:', error);
      throw error;
    }
  }

  /**
   * Apply server change with conflict resolution (last-write-wins)
   */
  private async applyServerChangeWithConflictResolution(
    serverItem: ServerItem
  ): Promise<ConflictInfo | null> {
    const serverId = serverItem.id;

    console.log(`Applying change for server item: ${serverId}`);

    // Check if item already exists locally (by serverId)
    const existingItems = await db.items
      .where('serverId')
      .equals(serverId)
      .toArray();

    const existingItem = existingItems.length > 0 ? existingItems[0] : null;

    // Handle deleted items
    if (serverItem.status === 'deleted') {
      if (existingItem) {
        await db.items.delete(existingItem.id);
        console.log(`Deleted local item: ${existingItem.id} (server: ${serverId})`);
      }
      return null; // No conflict for deletions
    }

    // Item exists locally - check for conflict
    if (existingItem) {
      return this.resolveConflict(existingItem, serverItem);
    }

    // New item from server - create locally (no conflict)
    await this.createLocalItemFromServer(serverItem);
    console.log(`Created new local item from server: ${serverId}`);
    return null;
  }

  /**
   * Resolve conflict using last-write-wins strategy
   */
  private async resolveConflict(
    localItem: LocalItem,
    serverItem: ServerItem
  ): Promise<ConflictInfo | null> {
    const localUpdatedAt = new Date(localItem.updatedAt);
    const remoteUpdatedAt = new Date(serverItem.updated_at);

    console.log(
      `Conflict detected for item ${serverItem.id}:`,
      `Local: ${localUpdatedAt.toISOString()}, Remote: ${remoteUpdatedAt.toISOString()}`
    );

    // Check if item has unsynced local changes
    const hasLocalChanges = localItem.syncedAt === null;

    // Last-write-wins: Compare timestamps
    if (remoteUpdatedAt > localUpdatedAt) {
      // Remote is newer - remote wins
      console.log(`Remote wins (${remoteUpdatedAt} > ${localUpdatedAt})`);

      await this.updateLocalItemFromServer(localItem, serverItem);

      return {
        itemId: serverItem.id,
        localVersion: localItem,
        remoteVersion: serverItem,
        resolution: 'remote_wins',
        reason: `Remote version is newer (${remoteUpdatedAt.toISOString()} > ${localUpdatedAt.toISOString()})`,
      };
    } else if (localUpdatedAt > remoteUpdatedAt) {
      // Local is newer - local wins (keep local)
      console.log(`Local wins (${localUpdatedAt} > ${remoteUpdatedAt})`);

      // Mark as unsynced so it will be pushed to server
      if (localItem.syncedAt !== null) {
        await db.items.update(localItem.id, {
          syncedAt: null as any,
        });
      }

      return {
        itemId: serverItem.id,
        localVersion: localItem,
        remoteVersion: serverItem,
        resolution: 'local_wins',
        reason: `Local version is newer (${localUpdatedAt.toISOString()} > ${remoteUpdatedAt.toISOString()})`,
      };
    } else {
      // Timestamps equal - if local has unsaved changes, local wins
      if (hasLocalChanges) {
        console.log('Timestamps equal, but local has unsynced changes - local wins');

        return {
          itemId: serverItem.id,
          localVersion: localItem,
          remoteVersion: serverItem,
          resolution: 'local_wins',
          reason: 'Timestamps equal, but local has unsynced changes',
        };
      } else {
        // Timestamps equal and no local changes - take remote to ensure consistency
        console.log('Timestamps equal, no local changes - taking remote');

        await this.updateLocalItemFromServer(localItem, serverItem);

        return {
          itemId: serverItem.id,
          localVersion: localItem,
          remoteVersion: serverItem,
          resolution: 'remote_wins',
          reason: 'Timestamps equal, taking remote for consistency',
        };
      }
    }
  }

  /**
   * Update existing local item with server data
   */
  private async updateLocalItemFromServer(
    localItem: LocalItem,
    serverItem: ServerItem
  ): Promise<void> {
    await db.items.update(localItem.id, {
      serverId: serverItem.id,
      text: serverItem.text,
      category: serverItem.category,
      status: serverItem.status,
      nextAction: serverItem.next_action,
      waitingFor: serverItem.waiting_for,
      projectPlan: serverItem.project_plan,
      hasCalendar: serverItem.has_calendar,
      updatedAt: new Date(serverItem.updated_at),
      syncedAt: new Date(), // Mark as synced
    });
  }

  /**
   * Create new local item from server data
   */
  private async createLocalItemFromServer(serverItem: ServerItem): Promise<void> {
    const localItem: LocalItem = {
      id: serverItem.id,
      serverId: serverItem.id,
      text: serverItem.text,
      category: serverItem.category,
      status: serverItem.status,
      nextAction: serverItem.next_action,
      waitingFor: serverItem.waiting_for,
      projectPlan: serverItem.project_plan,
      hasCalendar: serverItem.has_calendar,
      createdAt: new Date(serverItem.created_at),
      updatedAt: new Date(serverItem.updated_at),
      syncedAt: new Date(),
      pendingDelete: false,
    };

    await db.items.put(localItem);
  }

  /**
   * Push local changes to server
   */
  async pushChanges(): Promise<number> {
    try {
      const unsyncedItems = await db.items
        .where('syncedAt')
        .equals(null as any)
        .toArray();

      console.log(`Found ${unsyncedItems.length} unsynced items to push`);

      let pushed = 0;

      for (const item of unsyncedItems) {
        try {
          if (item.pendingDelete) {
            await this.deleteItemOnServer(item);
          } else if (item.serverId) {
            await this.updateItemOnServer(item);
          } else {
            await this.createItemOnServer(item);
          }

          pushed++;
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);
        }
      }

      return pushed;
    } catch (error) {
      console.error('Push changes error:', error);
      throw error;
    }
  }

  /**
   * Create item on server
   */
  private async createItemOnServer(item: LocalItem): Promise<void> {
    try {
      const response = await apiClient.post('/items', {
        text: item.text,
        category: item.category,
        nextAction: item.nextAction,
        waitingFor: item.waitingFor,
        projectPlan: item.projectPlan,
      });

      const serverItem = response.data.data;

      await db.items.update(item.id, {
        serverId: serverItem.id,
        syncedAt: new Date(),
        updatedAt: new Date(serverItem.updated_at),
      });

      console.log(`Created item on server: ${item.id} -> ${serverItem.id}`);
    } catch (error) {
      console.error(`Failed to create item ${item.id}:`, error);
      throw error;
    }
  }

  /**
   * Update item on server
   */
  private async updateItemOnServer(item: LocalItem): Promise<void> {
    if (!item.serverId) {
      throw new Error('Cannot update item without serverId');
    }

    try {
      const response = await apiClient.patch(`/items/${item.serverId}`, {
        text: item.text,
        category: item.category,
        status: item.status,
        nextAction: item.nextAction,
        waitingFor: item.waitingFor,
        projectPlan: item.projectPlan,
        hasCalendar: item.hasCalendar,
      });

      const serverItem = response.data.data;

      await db.items.update(item.id, {
        syncedAt: new Date(),
        updatedAt: new Date(serverItem.updated_at),
      });

      console.log(`Updated item on server: ${item.serverId}`);
    } catch (error) {
      console.error(`Failed to update item ${item.serverId}:`, error);
      throw error;
    }
  }

  /**
   * Delete item on server
   */
  private async deleteItemOnServer(item: LocalItem): Promise<void> {
    if (!item.serverId) {
      await db.items.delete(item.id);
      console.log(`Deleted local-only item: ${item.id}`);
      return;
    }

    try {
      await apiClient.delete(`/items/${item.serverId}`);
      await db.items.delete(item.id);
      console.log(`Deleted item on server: ${item.serverId}`);
    } catch (error) {
      if ((error as any).response?.status === 404) {
        await db.items.delete(item.id);
        console.log(`Item already deleted on server: ${item.serverId}`);
      } else {
        console.error(`Failed to delete item ${item.serverId}:`, error);
        throw error;
      }
    }
  }

  /**
   * Mark item for deletion
   */
  async markItemForDeletion(itemId: string): Promise<void> {
    await db.items.update(itemId, {
      pendingDelete: true,
      syncedAt: null as any,
    });

    console.log(`Marked item for deletion: ${itemId}`);
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    totalItems: number;
    syncedItems: number;
    unsyncedItems: number;
    pendingDeletes: number;
    lastPullTime: string | null;
  }> {
    const allItems = await db.items.toArray();
    const unsyncedItems = allItems.filter(item => !item.syncedAt);
    const pendingDeletes = allItems.filter(item => item.pendingDelete);
    const lastPullTime = await AsyncStorage.getItem(LAST_PULL_TIME_KEY);

    return {
      totalItems: allItems.length,
      syncedItems: allItems.length - unsyncedItems.length,
      unsyncedItems: unsyncedItems.length,
      pendingDeletes: pendingDeletes.length,
      lastPullTime,
    };
  }

  /**
   * Get last sync token
   */
  async getLastSyncToken(): Promise<string | null> {
    return AsyncStorage.getItem(SYNC_TOKEN_KEY);
  }

  /**
   * Reset sync
   */
  async resetSync(): Promise<void> {
    await db.items.clear();
    await AsyncStorage.removeItem(SYNC_TOKEN_KEY);
    await AsyncStorage.removeItem(LAST_PULL_TIME_KEY);
    console.log('Sync reset complete');
  }

  /**
   * Force full sync
   */
  async forceFullSync(): Promise<SyncResult> {
    console.log('Forcing full sync...');
    await AsyncStorage.removeItem(SYNC_TOKEN_KEY);
    return this.sync();
  }
}

export const syncService = new SyncService();
export type { ConflictInfo };
