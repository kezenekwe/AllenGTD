import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { authenticate } from '../middleware/auth';

const router = Router();

// ─── POST /api/v1/auth/register ────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email, password, and name are required',
        fields: {
          email: !email ? 'Email is required' : undefined,
          password: !password ? 'Password is required' : undefined,
          name: !name ? 'Name is required' : undefined,
        },
      });
    }

    // Register user
    const result = await authService.register({ email, password, name });

    return res.status(201).json({
      message: 'User registered successfully',
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    console.error('Registration error:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('already registered')) {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message,
        });
      }

      if (
        error.message.includes('Invalid') ||
        error.message.includes('required') ||
        error.message.includes('Password must')
      ) {
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
        });
      }
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register user',
    });
  }
});

// ─── POST /api/v1/auth/login ───────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email and password are required',
      });
    }

    // Login user
    const result = await authService.login({ email, password });

    return res.json({
      message: 'Login successful',
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    console.error('Login error:', error);

    if (error instanceof Error) {
      if (
        error.message.includes('Invalid email or password') ||
        error.message.includes('disabled')
      ) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: error.message,
        });
      }
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to login',
    });
  }
});

// ─── GET /api/v1/auth/me (Protected) ───────────────────────────────────────

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get user details
    const user = await authService.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    return res.json({
      user,
    });
  } catch (error) {
    console.error('Get user error:', error);

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user',
    });
  }
});

// ─── POST /api/v1/auth/logout (Optional - for completeness) ───────────────

router.post('/logout', authenticate, (_req: Request, res: Response) => {
  // With JWT, logout is handled client-side by deleting the token
  // Server doesn't need to do anything unless you implement token blacklisting

  res.json({
    message: 'Logout successful',
  });
});

export default router;
