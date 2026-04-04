import { Router } from 'express';

// ─── Auth Routes ───────────────────────────────────────────────────────────
// These will be implemented in Task 3.3

const router = Router();

// Placeholder routes
router.post('/register', (req, res) => {
  res.json({
    message: 'User registration endpoint (not yet implemented)',
    required: ['email', 'password', 'name'],
  });
});

router.post('/login', (req, res) => {
  res.json({
    message: 'User login endpoint (not yet implemented)',
    required: ['email', 'password'],
  });
});

router.get('/me', (req, res) => {
  res.json({
    message: 'Get current user endpoint (not yet implemented)',
    requiresAuth: true,
  });
});

export default router;
