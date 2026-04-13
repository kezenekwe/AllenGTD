import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { syncService } from '../services/syncService';

const router = Router();

// ─── All sync routes require authentication ───────────────────────────────

router.use(authenticate);

// ─── GET /api/sync ─────────────────────────────────────────────────────────

/**
 * Get changes since last sync
 * 
 * Query Parameters:
 *   - since: Sync token (ISO timestamp or Unix milliseconds)
 * 
 * Examples:
 *   GET /api/sync?since=2025-01-15T10:00:00.000Z
 *   GET /api/sync?since=1737024000000
 *   GET /api/sync (first sync - returns all items)
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
    const sinceToken = req.query.since as string | undefined;

    // Validate and parse sync token if provided
    let sinceTimestamp: Date | null = null;

    if (sinceToken) {
      try {
        // Try parsing as ISO timestamp
        if (sinceToken.includes('T') || sinceToken.includes('-')) {
          sinceTimestamp = new Date(sinceToken);
        } else {
          // Try parsing as Unix milliseconds
          const unixMs = parseInt(sinceToken, 10);
          if (!isNaN(unixMs)) {
            sinceTimestamp = new Date(unixMs);
          } else {
            return res.status(400).json({
              error: 'Validation Error',
              message: 'Invalid sync token format. Use ISO timestamp or Unix milliseconds.',
            });
          }
        }

        // Validate the timestamp is valid
        if (isNaN(sinceTimestamp.getTime())) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid sync token format. Use ISO timestamp or Unix milliseconds.',
          });
        }

        // Check if timestamp is in the future
        if (sinceTimestamp > new Date()) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Sync token cannot be in the future',
          });
        }
      } catch (error) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid sync token format. Use ISO timestamp or Unix milliseconds.',
        });
      }
    }

    // Get changes since timestamp
    const result = await syncService.getChangesSince(userId, sinceTimestamp);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Sync error:', error);

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch sync changes',
    });
  }
});

// ─── POST /api/sync ────────────────────────────────────────────────────────

/**
 * Push local changes to server
 * 
 * Request Body:
 *   {
 *     changes: [
 *       { id: "...", text: "...", category: "...", ... },
 *       ...
 *     ],
 *     lastSyncToken: "..." (optional)
 *   }
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
    const { changes, lastSyncToken } = req.body;

    // Validate changes array
    if (!Array.isArray(changes)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Changes must be an array',
      });
    }

    // Apply changes
    const result = await syncService.applyChanges(userId, changes, lastSyncToken);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Sync push error:', error);

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to apply sync changes',
    });
  }
});

// ─── GET /api/sync/status ──────────────────────────────────────────────────

/**
 * Get sync status information
 * 
 * Returns:
 *   - Total item count
 *   - Item counts by category
 *   - Last modified timestamp
 *   - Current sync token
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userId = req.user.userId;
    const status = await syncService.getSyncStatus(userId);

    return res.status(200).json(status);
  } catch (error) {
    console.error('Sync status error:', error);

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch sync status',
    });
  }
});

export default router;
