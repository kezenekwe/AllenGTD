import { query } from '../db/connection';

// ─── Types ────────────────────────────────────────────────────────────────

interface Item {
  id: string;
  user_id: string;
  text: string;
  category: 'inbox' | 'nextActions' | 'projects' | 'waiting' | 'someday' | 'reference';
  status: 'active' | 'completed' | 'deleted';
  next_action: string | null;
  waiting_for: string | null;
  project_plan: string | null;
  has_calendar: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ItemFilters {
  category?: string;
  status?: string;
}

interface CreateItemData {
  text: string;
  category: string;
  nextAction?: string;
  waitingFor?: string;
  projectPlan?: string;
}

interface UpdateItemData {
  text?: string;
  category?: string;
  status?: string;
  nextAction?: string;
  waitingFor?: string;
  projectPlan?: string;
  hasCalendar?: boolean;
}

// ─── Items Service ────────────────────────────────────────────────────────

export class ItemsService {
  /**
   * Get all items for a user with optional filters
   */
  async getItems(userId: string, filters: ItemFilters = {}): Promise<Item[]> {
    let sql = `
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
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    // Add category filter
    if (filters.category) {
      sql += ` AND category = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }

    // Add status filter (default to active if not specified)
    if (filters.status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    } else {
      // Default: only show active items
      sql += ` AND status = $${paramIndex}`;
      params.push('active');
      paramIndex++;
    }

    // Order by created date (newest first)
    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Get a single item by ID
   * Only returns if item belongs to the user
   */
  async getItemById(userId: string, itemId: string): Promise<Item | null> {
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
      WHERE id = $1 AND user_id = $2`,
      [itemId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Create a new item
   */
  async createItem(userId: string, data: CreateItemData): Promise<Item> {
    const result = await query(
      `INSERT INTO items (
        user_id,
        text,
        category,
        status,
        next_action,
        waiting_for,
        project_plan,
        has_calendar
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING 
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
        updated_at`,
      [
        userId,
        data.text,
        data.category,
        'active', // New items are always active
        data.nextAction || null,
        data.waitingFor || null,
        data.projectPlan || null,
        false, // Default has_calendar to false
      ]
    );

    return result.rows[0];
  }

  /**
   * Update an item
   * Only updates if item belongs to the user
   */
  async updateItem(
    userId: string,
    itemId: string,
    updates: UpdateItemData
  ): Promise<Item | null> {
    // Build dynamic UPDATE query
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.text !== undefined) {
      fields.push(`text = $${paramIndex}`);
      values.push(updates.text);
      paramIndex++;
    }

    if (updates.category !== undefined) {
      fields.push(`category = $${paramIndex}`);
      values.push(updates.category);
      paramIndex++;
    }

    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }

    if (updates.nextAction !== undefined) {
      fields.push(`next_action = $${paramIndex}`);
      values.push(updates.nextAction);
      paramIndex++;
    }

    if (updates.waitingFor !== undefined) {
      fields.push(`waiting_for = $${paramIndex}`);
      values.push(updates.waitingFor);
      paramIndex++;
    }

    if (updates.projectPlan !== undefined) {
      fields.push(`project_plan = $${paramIndex}`);
      values.push(updates.projectPlan);
      paramIndex++;
    }

    if (updates.hasCalendar !== undefined) {
      fields.push(`has_calendar = $${paramIndex}`);
      values.push(updates.hasCalendar);
      paramIndex++;
    }

    // Always update updated_at
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (fields.length === 1) {
      // Only updated_at was set, nothing to update
      return this.getItemById(userId, itemId);
    }

    // Add WHERE clause parameters
    values.push(itemId);
    values.push(userId);

    const sql = `
      UPDATE items
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING 
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
    `;

    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Delete an item (soft delete - sets status to 'deleted')
   * Only deletes if item belongs to the user
   */
  async deleteItem(userId: string, itemId: string): Promise<boolean> {
    const result = await query(
      `UPDATE items
       SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [itemId, userId]
    );

    return result.rows.length > 0;
  }

  /**
   * Hard delete an item (permanently remove from database)
   * Use with caution - this cannot be undone
   */
  async hardDeleteItem(userId: string, itemId: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM items
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [itemId, userId]
    );

    return result.rows.length > 0;
  }

  /**
   * Get item count by category for a user
   */
  async getItemCounts(userId: string): Promise<Record<string, number>> {
    const result = await query(
      `SELECT category, COUNT(*) as count
       FROM items
       WHERE user_id = $1 AND status = 'active'
       GROUP BY category`,
      [userId]
    );

    const counts: Record<string, number> = {
      inbox: 0,
      nextActions: 0,
      projects: 0,
      waiting: 0,
      someday: 0,
      reference: 0,
    };

    result.rows.forEach(row => {
      counts[row.category] = parseInt(row.count);
    });

    return counts;
  }
}

// Export singleton instance
export const itemsService = new ItemsService();
