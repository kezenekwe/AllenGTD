import { Router, Request, Response } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { authService } from '../services/authService';

const router = Router();

// ─── Protected Route (Requires Authentication) ────────────────────────────

/**
 * GET /api/auth/me
 * Get current authenticated user's information
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    // req.user is guaranteed to exist because of authenticate middleware
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found in request',
      });
    }

    // Fetch full user details from database
    const user = await authService.getUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    return res.status(200).json({
      data: user,
    });
  } catch (error) {
    console.error('Get current user error:', error);

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user information',
    });
  }
});

// ─── Protected Route (User Profile Update) ────────────────────────────────

/**
 * PATCH /api/auth/profile
 * Update current user's profile
 */
router.patch('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Name is required',
      });
    }

    // Update user's name in database
    const updatedUser = await authService.updateUserProfile(
      req.user.userId,
      { name: name.trim() }
    );

    return res.status(200).json({
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update profile',
    });
  }
});

// ─── Public Route with Optional Auth ───────────────────────────────────────

/**
 * GET /api/auth/public
 * Public route that shows different content for authenticated users
 */
router.get('/public', optionalAuth, (req: Request, res: Response) => {
  if (req.user) {
    return res.status(200).json({
      message: `Hello, ${req.user.email}! You are authenticated.`,
      authenticated: true,
      user: req.user,
    });
  } else {
    return res.status(200).json({
      message: 'Hello, anonymous user!',
      authenticated: false,
    });
  }
});

// ─── Test Route (Protected) ────────────────────────────────────────────────

/**
 * GET /api/auth/test-protected
 * Simple test route to verify authentication works
 */
router.get('/test-protected', authenticate, (req: Request, res: Response) => {
  return res.status(200).json({
    message: 'Access granted! You are authenticated.',
    user: req.user,
    timestamp: new Date().toISOString(),
  });
});

export default router;
