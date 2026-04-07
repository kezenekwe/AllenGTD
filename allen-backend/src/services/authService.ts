import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection';

// ─── Types ─────────────────────────────────────────────────────────────────

interface UserRegistration {
  email: string;
  password: string;
  name: string;
}

interface UserLogin {
  email: string;
  password: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  created_at: Date;
  is_active: boolean;
}

interface AuthToken {
  token: string;
  user: User;
}

// ─── Configuration ─────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = 10;

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Hash a password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);
  return hash;
}

/**
 * Compare password with hash
 */
async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
function generateToken(userId: string, email: string): string {
  const payload = {
    userId,
    email,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): { userId: string; email: string } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
    };

    if (!decoded.userId) {
      throw new Error('Invalid token: missing userId');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    if (error instanceof Error && error.message.startsWith('Invalid token')) {
      throw error;
    }
    throw new Error('Invalid token');
  }
}

// ─── Validation ────────────────────────────────────────────────────────────

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters long',
    };
  }

  // Optional: Add more password requirements
  // if (!/[A-Z]/.test(password)) {
  //   return { valid: false, message: 'Password must contain an uppercase letter' };
  // }

  return { valid: true };
}

// ─── Auth Service ──────────────────────────────────────────────────────────

export class AuthService {
  /**
   * Register a new user
   */
  async register(data: UserRegistration): Promise<AuthToken> {
    const { email, password, name } = data;

    // Validate email
    if (!validateEmail(email)) {
      throw new Error('Invalid email address');
    }

    // Validate password
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      throw new Error(passwordCheck.message || 'Invalid password');
    }

    // Validate name
    if (!name || name.trim().length === 0) {
      throw new Error('Name is required');
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert user
    const result = await query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, created_at, is_active`,
      [email.toLowerCase(), passwordHash, name.trim()]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = generateToken(user.id, user.email);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        is_active: user.is_active,
      },
    };
  }

  /**
   * Login user
   */
  async login(data: UserLogin): Promise<AuthToken> {
    const { email, password } = data;

    // Validate inputs
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Find user
    const result = await query(
      `SELECT id, email, password_hash, name, created_at, is_active
       FROM users
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is disabled');
    }

    // Compare password
    const isValidPassword = await comparePassword(
      password,
      user.password_hash
    );

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate JWT token
    const token = generateToken(user.id, user.email);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        is_active: user.is_active,
      },
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const result = await query(
      `SELECT id, email, name, created_at, is_active
       FROM users
       WHERE id = $1 AND is_active = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, data: { name: string }): Promise<User | null> {
    const result = await query(
      `UPDATE users SET name = $1 WHERE id = $2 AND is_active = true
       RETURNING id, email, name, created_at, is_active`,
      [data.name, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const result = await query(
      `SELECT id, email, name, created_at, is_active
       FROM users
       WHERE email = $1 AND is_active = true`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }
}

// Export singleton instance
export const authService = new AuthService();
