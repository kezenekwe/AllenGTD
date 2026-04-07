import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { itemsService } from '../services/itemsService';

const router = Router();

// ─── All items routes require authentication ──────────────────────────────

router.use(authenticate);

// ─── GET /api/items ────────────────────────────────────────────────────────

/**
 * Get all items for the authenticated user
 * 
 * Query Parameters:
 *   - category: Filter by category (inbox, next, projects, waiting, someday, reference)
 *   - status: Filter by status (active, completed, deleted)
 * 
 * Examples:
 *   GET /api/items
 *   GET /api/items?category=inbox
 *   GET /api/items?category=next&status=active
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userId = req.user.userId;
    const category = req.query.category as string | undefined;
    const status = req.query.status as string | undefined;

    // Validate category if provided
    if (category) {
      const validCategories = ['inbox', 'nextActions', 'projects', 'waiting', 'someday', 'reference'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
        });
      }
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ['active', 'completed', 'deleted'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
      }
    }

    // Fetch items
    const items = await itemsService.getItems(userId, {
      category,
      status,
    });

    return res.status(200).json({
      data: items,
      count: items.length,
      filters: {
        category: category || 'all',
        status: status || 'all',
      },
    });
  } catch (error) {
    console.error('Get items error:', error);

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch items',
    });
  }
});

// ─── GET /api/items/:id ────────────────────────────────────────────────────

/**
 * Get a single item by ID
 * Only returns if item belongs to authenticated user
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userId = req.user.userId;
    const itemId = req.params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(itemId)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid item ID format',
      });
    }

    const item = await itemsService.getItemById(userId, itemId);

    if (!item) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Item not found',
      });
    }

    return res.status(200).json({
      data: item,
    });
  } catch (error) {
    console.error('Get item error:', error);

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch item',
    });
  }
});

// ─── POST /api/items ───────────────────────────────────────────────────────

/**
 * Create a new item
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userId = req.user.userId;
    const { text, category, nextAction, waitingFor, projectPlan } = req.body;

    // Validate required fields
    if (!text || !category) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Text and category are required',
      });
    }

    // Validate category
    const validCategories = ['inbox', 'nextActions', 'projects', 'waiting', 'someday', 'reference'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      });
    }

    const item = await itemsService.createItem(userId, {
      text,
      category,
      nextAction,
      waitingFor,
      projectPlan,
    });

    return res.status(201).json({
      message: 'Item created successfully',
      data: item,
    });
  } catch (error) {
    console.error('Create item error:', error);

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create item',
    });
  }
});

// ─── PATCH /api/items/:id ──────────────────────────────────────────────────

/**
 * Update an item
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userId = req.user.userId;
    const itemId = req.params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(itemId)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid item ID format',
      });
    }

    const updates = req.body;

    // Validate category if provided
    if (updates.category) {
      const validCategories = ['inbox', 'nextActions', 'projects', 'waiting', 'someday', 'reference'];
      if (!validCategories.includes(updates.category)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
        });
      }
    }

    // Validate status if provided
    if (updates.status) {
      const validStatuses = ['active', 'completed', 'deleted'];
      if (!validStatuses.includes(updates.status)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
      }
    }

    const item = await itemsService.updateItem(userId, itemId, updates);

    if (!item) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Item not found',
      });
    }

    return res.status(200).json({
      message: 'Item updated successfully',
      data: item,
    });
  } catch (error) {
    console.error('Update item error:', error);

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update item',
    });
  }
});

// ─── DELETE /api/items/:id ─────────────────────────────────────────────────

/**
 * Delete an item (soft delete - sets status to 'deleted')
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userId = req.user.userId;
    const itemId = req.params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(itemId)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid item ID format',
      });
    }

    const deleted = await itemsService.deleteItem(userId, itemId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Item not found',
      });
    }

    return res.status(200).json({
      message: 'Item deleted successfully',
    });
  } catch (error) {
    console.error('Delete item error:', error);

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete item',
    });
  }
});

export default router;
