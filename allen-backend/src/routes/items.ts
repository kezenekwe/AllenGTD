import { Router } from 'express';

// ─── Item Routes ───────────────────────────────────────────────────────────
// These will be implemented in Task 3.2

const router = Router();

// Placeholder routes
router.get('/', (req, res) => {
  res.json({
    message: 'Items API',
    endpoints: {
      'GET /items': 'Get all items for authenticated user',
      'POST /items': 'Create a new item',
      'PUT /items/:id': 'Update an item',
      'DELETE /items/:id': 'Delete an item',
    },
  });
});

export default router;
