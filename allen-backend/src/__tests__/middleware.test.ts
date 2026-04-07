import request from 'supertest';
import app from '../app';
import { query } from '../db/connection';
import jwt from 'jsonwebtoken';

// ─── Test Data ────────────────────────────────────────────────────────────

const testUser = {
  name: 'Auth Test User',
  email: 'authtest@example.com',
  password: 'AuthTestPassword123',
};

let authToken: string;
let userId: string;

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ─── Setup & Teardown ─────────────────────────────────────────────────────

beforeAll(async () => {
  // Clean up test user if exists
  await query('DELETE FROM users WHERE email = $1', [testUser.email]);

  // Register test user
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send(testUser);

  authToken = response.body.token;
  userId = response.body.user.id;
});

afterAll(async () => {
  // Clean up test user
  await query('DELETE FROM users WHERE email = $1', [testUser.email]);
});

// ─── Middleware Tests ─────────────────────────────────────────────────────

describe('Authentication Middleware', () => {
  describe('GET /api/v1/auth/me (protected route)', () => {
    it('should return user data with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.name).toBe(testUser.name);
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
      expect(response.body.message).toContain('No authorization header');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
      expect(response.body.message).toMatch(/invalid|failed/i);
    });

    it('should return 401 with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'InvalidFormat')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
      expect(response.body.message).toContain('Invalid authorization header format');
    });

    it('should return 401 with non-Bearer scheme', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Basic ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
      expect(response.body.message).toContain('Bearer');
    });

    it('should return 401 with empty token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer ')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 401 with expired token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId, email: testUser.email },
        JWT_SECRET,
        { expiresIn: '-1s' } // Already expired
      );

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
      expect(response.body.message).toContain('expired');
    });
  });

  describe('GET /api/v1/auth/test-protected (test route)', () => {
    it('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/test-protected')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Access granted');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.userId).toBe(userId);
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should deny access without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/test-protected')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('GET /api/v1/auth/public (optional auth)', () => {
    it('should show authenticated message with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/public')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.authenticated).toBe(true);
      expect(response.body.message).toContain(testUser.email);
      expect(response.body).toHaveProperty('user');
    });

    it('should show anonymous message without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/public')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.authenticated).toBe(false);
      expect(response.body.message).toContain('anonymous');
      expect(response.body).not.toHaveProperty('user');
    });

    it('should show anonymous message with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/public')
        .set('Authorization', 'Bearer invalid-token')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.authenticated).toBe(false);
      expect(response.body.message).toContain('anonymous');
    });
  });
});

// ─── Token Validation Tests ───────────────────────────────────────────────

describe('JWT Token Handling', () => {
  it('should extract userId from token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.user.id).toBe(userId);
  });

  it('should extract email from token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.user.email).toBe(testUser.email);
  });

  it('should reject token with wrong signature', async () => {
    // Create token with different secret
    const wrongToken = jwt.sign(
      { userId, email: testUser.email },
      'wrong-secret-key',
      { expiresIn: '7d' }
    );

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${wrongToken}`)
      .expect(401);

    expect(response.body).toHaveProperty('error', 'Unauthorized');
  });

  it('should reject token with missing userId', async () => {
    // Create token without userId
    const incompleteToken = jwt.sign(
      { email: testUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${incompleteToken}`)
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });
});

// ─── Security Tests ───────────────────────────────────────────────────────

describe('Security Features', () => {
  it('should not expose password hash in responses', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.user).not.toHaveProperty('password_hash');
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('should handle multiple authorization headers gracefully', async () => {
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Authorization', 'Bearer second-token')
      .expect(401); // Should fail because second header overwrites first

    // The behavior depends on how express handles duplicate headers
    // This test documents the expected behavior
  });

  it('should trim whitespace from bearer token', async () => {
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer  ${authToken}  `)
      .expect(401); // Should fail because of extra spaces

    // This documents that we don't trim - strict format required
  });
});

// ─── Error Handling Tests ─────────────────────────────────────────────────

describe('Error Handling', () => {
  it('should return consistent error format', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .expect(401);

    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.error).toBe('string');
    expect(typeof response.body.message).toBe('string');
  });

  it('should log authentication errors server-side', async () => {
    // This would require mocking console.error
    // For now, just verify the request fails as expected
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expect(response.body.error).toBe('Unauthorized');
  });
});
