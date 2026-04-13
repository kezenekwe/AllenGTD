import { query } from '../db/connection';

// ─── Types ────────────────────────────────────────────────────────────────

interface Item {
  id: string;
  user_id: string;
  text: string;
  category: string;
  status: string;
  next_action: string | null;
  waiting_for: string | null;
  project_plan: string | null;
  has_calendar: boolean;
  created_at: Date;
  updated_at: Date;
}

interface SyncResult {
  changes: Item[];
  syncToken: string;
  timestamp: string;
  count: number;
}

interface SyncStatus {
  totalItems: number;
  itemsByCategory: Record<string, number>;
  itemsByStatus: Record<string, number>;
  lastModified: string | null;
  syncToken: string;
}

interface ApplyChangesResult {
  applied: number;
  conflicts: number;
  errors: number;
  syncToken: string;
}

// ─── Sync Service ─────────────────────────────────────────────────────────

export class SyncService {
  /**
   * Get all changes since a given timestamp
   * Returns items that were created, updated, or deleted since the token
   */
  async getChangesSince(
    userId: string,
    sinceTimestamp: Date | null
  ): Promise<SyncResult> {
    let sql: string;
    let params: any[];

    if (sinceTimestamp) {
      // Get items modified since the timestamp
      sql = `
        SELECT 
          id,
          user_id,
          text,
          category,
          status,
          next_action,
          waiting_for,
          project_plan,
          has_calendar,
          created_at,
          updated_at
        FROM items
        WHERE user_id = $1 AND updated_at > $2
        ORDER BY updated_at ASC
      `;
      params = [userId, sinceTimestamp];
    } else {
      // First sync - get all items
      sql = `
        SELECT 
          id,
          user_id,
          text,
          category,
          status,
          next_action,
          waiting_for,
          project_plan,
          has_calendar,
          created_at,
          updated_at
        FROM items
        WHERE user_id = $1
        ORDER BY updated_at ASC
      `;
      params = [userId];
    }

    const result = await query(sql, params);
    const changes = result.rows;

    // Generate new sync token (current timestamp)
    const now = new Date();
    const syncToken = now.toISOString();

    return {
      changes,
      syncToken,
      timestamp: syncToken,
      count: changes.length,
    };
  }

  /**
   * Apply changes from client to server
   * Handles conflict resolution (server wins for now)
   */
  async applyChanges(
    userId: string,
    changes: any[],
    lastSyncToken?: string
  ): Promise<ApplyChangesResult> {
    let applied = 0;
    let conflicts = 0;
    let errors = 0;

    for (const change of changes) {
      try {
        // Check if item exists
        const existing = await query(
          'SELECT id, updated_at FROM items WHERE id = $1 AND user_id = $2',
          [change.id, userId]
        );

        if (existing.rows.length > 0) {
          // Item exists - update it
          // Check for conflicts (server was modified after client's last sync)
          if (lastSyncToken) {
            const serverUpdatedAt = new Date(existing.rows[0].updated_at);
            const clientLastSync = new Date(lastSyncToken);

            if (serverUpdatedAt > clientLastSync) {
              // Conflict: Server was modified after client's last sync
              // For now, server wins (skip client's change)
              conflicts++;
              continue;
            }
          }

          // Apply update
          await query(
            `UPDATE items
             SET text = $1,
                 category = $2,
                 status = $3,
                 next_action = $4,
                 waiting_for = $5,
                 project_plan = $6,
                 has_calendar = $7,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $8 AND user_id = $9`,
            [
              change.text,
              change.category,
              change.status,
              change.nextAction || null,
              change.waitingFor || null,
              change.projectPlan || null,
              change.hasCalendar || false,
              change.id,
              userId,
            ]
          );
          applied++;
        } else {
          // Item doesn't exist - create it
          await query(
            `INSERT INTO items (
               id,
               user_id,
               text,
               category,
               status,
               next_action,
               waiting_for,
               project_plan,
               has_calendar,
               created_at,
               updated_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
            [
              change.id,
              userId,
              change.text,
              change.category,
              change.status || 'active',
              change.nextAction || null,
              change.waitingFor || null,
              change.projectPlan || null,
              change.hasCalendar || false,
              change.createdAt ? new Date(change.createdAt) : new Date(),
            ]
          );
          applied++;
        }
      } catch (error) {
        console.error('Error applying change:', error);
        errors++;
      }
    }

    // Generate new sync token
    const syncToken = new Date().toISOString();

    return {
      applied,
      conflicts,
      errors,
      syncToken,
    };
  }

  /**
   * Get sync status information
   */
  async getSyncStatus(userId: string): Promise<SyncStatus> {
    // Get total count
    const totalResult = await query(
      'SELECT COUNT(*) as count FROM items WHERE user_id = $1',
      [userId]
    );
    const totalItems = parseInt(totalResult.rows[0].count);

    // Get counts by category
    const categoryResult = await query(
      `SELECT category, COUNT(*) as count
       FROM items
       WHERE user_id = $1
       GROUP BY category`,
      [userId]
    );

    const itemsByCategory: Record<string, number> = {
      inbox: 0,
      nextActions: 0,
      projects: 0,
      waiting: 0,
      someday: 0,
      reference: 0,
    };

    categoryResult.rows.forEach(row => {
      itemsByCategory[row.category] = parseInt(row.count);
    });

    // Get counts by status
    const statusResult = await query(
      `SELECT status, COUNT(*) as count
       FROM items
       WHERE user_id = $1
       GROUP BY status`,
      [userId]
    );

    const itemsByStatus: Record<string, number> = {
      active: 0,
      completed: 0,
      deleted: 0,
    };

    statusResult.rows.forEach(row => {
      itemsByStatus[row.status] = parseInt(row.count);
    });

    // Get last modified timestamp
    const lastModifiedResult = await query(
      `SELECT MAX(updated_at) as last_modified
       FROM items
       WHERE user_id = $1`,
      [userId]
    );

    const lastModified = lastModifiedResult.rows[0].last_modified;

    // Generate current sync token
    const syncToken = new Date().toISOString();

    return {
      totalItems,
      itemsByCategory,
      itemsByStatus,
      lastModified: lastModified ? new Date(lastModified).toISOString() : null,
      syncToken,
    };
  }

  /**
   * Get items modified in a specific time range
   * Useful for debugging and testing
   */
  async getChangesBetween(
    userId: string,
    startTime: Date,
    endTime: Date
  ): Promise<Item[]> {
    const result = await query(
      `SELECT 
        id,
        user_id,
        text,
        category,
        status,
        next_action,
        waiting_for,
        project_plan,
        has_calendar,
        created_at,
        updated_at
      FROM items
      WHERE user_id = $1 
        AND updated_at > $2 
        AND updated_at <= $3
      ORDER BY updated_at ASC`,
      [userId, startTime, endTime]
    );

    return result.rows;
  }

  /**
   * Clear all sync data for a user (use with caution!)
   * This is primarily for testing
   */
  async clearUserData(userId: string): Promise<boolean> {
    try {
      await query('DELETE FROM items WHERE user_id = $1', [userId]);
      return true;
    } catch (error) {
      console.error('Error clearing user data:', error);
      return false;
    }
  }
}

// Export singleton instance
export const syncService = new SyncService();
