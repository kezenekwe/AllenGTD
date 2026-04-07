import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';

// ─── Extend Express Request Type ──────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

// ─── Authentication Middleware ────────────────────────────────────────────

/**
 * Verify JWT token and attach user to request
 * 
 * Usage:
 *   router.get('/protected', authenticate, (req, res) => {
 *     res.json({ user: req.user });
 *   });
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // 1. Get Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No authorization header provided',
      });
      return;
    }

    // 2. Check Bearer token format
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authorization header format',
      });
      return;
    }

    const [scheme, token] = parts;

    if (scheme !== 'Bearer') {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authorization scheme must be Bearer',
      });
      return;
    }

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
      });
      return;
    }

    // 3. Verify token
    const decoded = verifyToken(token);

    // 4. Attach user to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    // 5. Continue to next middleware/route handler
    next();
  } catch (error) {
    console.error('Authentication error:', error);

    // Handle JWT-specific errors
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Token has expired',
        });
        return;
      }

      if (error.message.includes('invalid')) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token',
        });
        return;
      }
    }

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed',
    });
  }
}

// ─── Optional Authentication ──────────────────────────────────────────────

/**
 * Optional authentication - doesn't fail if no token provided
 * Useful for routes that work differently for authenticated users
 * 
 * Usage:
 *   router.get('/public', optionalAuth, (req, res) => {
 *     if (req.user) {
 *       // User is authenticated
 *     } else {
 *       // Anonymous user
 *     }
 *   });
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const parts = authHeader.split(' ');
      
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const decoded = verifyToken(token);
        
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
        };
      }
    }

    // Always continue - authentication is optional
    next();
  } catch (error) {
    // Silently fail - just continue without user
    console.log('Optional auth failed:', error);
    next();
  }
}

// ─── Role-Based Authentication (Future Enhancement) ───────────────────────

/**
 * Check if user has required role
 * This is a template for future role-based access control
 */
export function requireRole(_role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // TODO: Fetch user roles from database and check
    // For now, just pass through
    next();
  };
}
