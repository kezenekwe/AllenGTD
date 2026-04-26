import { query } from '../db/connection';

// ─── Constants ────────────────────────────────────────────────────────────

const SYNC_PAGE_SIZE = 500;

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
  hasMore: boolean;
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
      // Get items modified since the timestamp, capped to SYNC_PAGE_SIZE
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
        LIMIT $3
      `;
      params = [userId, sinceTimestamp, SYNC_PAGE_SIZE];
    } else {
      // First sync - paginated to avoid huge responses
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
        LIMIT $2
      `;
      params = [userId, SYNC_PAGE_SIZE];
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
      hasMore: changes.length === SYNC_PAGE_SIZE,
    };
  }

  /**
   * Apply changes from client to server.
   *
   * Optimized: existence check is batched (1 query instead of N),
   * and new items are bulk-inserted with UNNEST (1 query instead of N).
   */
  async applyChanges(
    userId: string,
    changes: any[],
    lastSyncToken?: string
  ): Promise<ApplyChangesResult> {
    let applied = 0;
    let conflicts = 0;
    let errors = 0;

    if (changes.length === 0) {
      return { applied, conflicts, errors, syncToken: new Date().toISOString() };
    }

    // ─── 1. Batch existence check (1 query instead of N) ─────────────────
    const changeIds = changes.map(c => c.id);
    let existingMap = new Map<string, { id: string; updated_at: Date }>();

    try {
      const existingResult = await query(
        'SELECT id, updated_at FROM items WHERE id = ANY($1::uuid[]) AND user_id = $2',
        [changeIds, userId]
      );
      existingMap = new Map(existingResult.rows.map(r => [r.id, r]));
    } catch (error) {
      console.error('Batch existence check failed, treating all as new:', error);
    }

    // ─── 2. Classify changes into inserts vs updates ──────────────────────
    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    for (const change of changes) {
      const existing = existingMap.get(change.id);
      if (existing) {
        if (lastSyncToken) {
          const serverUpdatedAt = new Date(existing.updated_at);
          const clientLastSync = new Date(lastSyncToken);
          if (serverUpdatedAt > clientLastSync) {
            conflicts++;
            continue;
          }
        }
        toUpdate.push(change);
      } else {
        toInsert.push(change);
      }
    }

    // ─── 3. Bulk INSERT new items (1 query instead of N) ──────────────────
    if (toInsert.length > 0) {
      try {
        await query(
          `INSERT INTO items
             (id, user_id, text, category, status,
              next_action, waiting_for, project_plan, has_calendar,
              created_at, updated_at)
           SELECT * FROM UNNEST(
             $1::uuid[], $2::uuid[], $3::text[], $4::text[], $5::text[],
             $6::text[], $7::text[], $8::text[], $9::boolean[],
             $10::timestamptz[], $11::timestamptz[]
           )
           ON CONFLICT (id) DO NOTHING`,
          [
            toInsert.map(c => c.id),
            toInsert.map(() => userId),
            toInsert.map(c => c.text),
            toInsert.map(c => c.category || 'inbox'),
            toInsert.map(c => c.status || 'active'),
            toInsert.map(c => c.nextAction   ?? null),
            toInsert.map(c => c.waitingFor   ?? null),
            toInsert.map(c => c.projectPlan  ?? null),
            toInsert.map(c => c.hasCalendar  ?? false),
            toInsert.map(c => c.createdAt ? new Date(c.createdAt) : new Date()),
            toInsert.map(() => new Date()),
          ]
        );
        applied += toInsert.length;
      } catch (error) {
        console.error('Bulk insert failed:', error);
        errors += toInsert.length;
      }
    }

    // ─── 4. Individual UPDATEs (conflict logic requires per-row handling) ─
    for (const change of toUpdate) {
      try {
        await query(
          `UPDATE items
             SET text          = $1,
                 category      = $2,
                 status        = $3,
                 next_action   = $4,
                 waiting_for   = $5,
                 project_plan  = $6,
                 has_calendar  = $7,
                 updated_at    = CURRENT_TIMESTAMP
           WHERE id = $8 AND user_id = $9`,
          [
            change.text,
            change.category,
            change.status,
            change.nextAction  ?? null,
            change.waitingFor  ?? null,
            change.projectPlan ?? null,
            change.hasCalendar ?? false,
            change.id,
            userId,
          ]
        );
        applied++;
      } catch (error) {
        console.error('Update failed for item:', change.id, error);
        errors++;
      }
    }

    return { applied, conflicts, errors, syncToken: new Date().toISOString() };
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
