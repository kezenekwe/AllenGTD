import request from 'supertest';
import app from '../app';
import { query } from '../db/connection';

// ─── Test Data ────────────────────────────────────────────────────────────

const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'TestPassword123',
};

let authToken: string;
let userId: string;

// ─── Setup & Teardown ─────────────────────────────────────────────────────

beforeAll(async () => {
  // Clean up test user if exists
  await query('DELETE FROM users WHERE email = $1', [testUser.email]);
});

afterAll(async () => {
  // Clean up test user
  await query('DELETE FROM users WHERE email = $1', [testUser.email]);
});

// ─── Registration Tests ───────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('should register a new user', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(response.body).toHaveProperty('message', 'User registered successfully');
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(testUser.email);
    expect(response.body.user.name).toBe(testUser.name);

    // Save for later tests
    authToken = response.body.token;
    userId = response.body.user.id;
  });

  it('should reject duplicate email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect('Content-Type', /json/)
      .expect(409);

    expect(response.body).toHaveProperty('error', 'Conflict');
    expect(response.body.message).toContain('already registered');
  });

  it('should reject invalid email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test User',
        email: 'invalid-email',
        password: 'TestPassword123',
      })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Validation Error');
    expect(response.body.message).toContain('Invalid email');
  });

  it('should reject short password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test User',
        email: 'test2@example.com',
        password: '123',
      })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Validation Error');
    expect(response.body.message).toContain('at least 8 characters');
  });

  it('should reject missing fields', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test2@example.com',
        // missing name and password
      })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Validation Error');
  });
});

// ─── Login Tests ──────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('should login with correct credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('message', 'Login successful');
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(testUser.email);
    expect(response.body.token).toBeTruthy();
  });

  it('should reject incorrect password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword123',
      })
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('error', 'Unauthorized');
    expect(response.body.message).toContain('Invalid email or password');
  });

  it('should reject non-existent email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'TestPassword123',
      })
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('error', 'Unauthorized');
    expect(response.body.message).toContain('Invalid email or password');
  });

  it('should reject missing email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        password: 'TestPassword123',
      })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Validation Error');
  });

  it('should reject missing password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
      })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Validation Error');
  });
});

// ─── Get Current User Tests ───────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('should get current user with valid token', async () => {
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

  it('should reject request without token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('error', 'Unauthorized');
  });

  it('should reject invalid token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token-here')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('error', 'Unauthorized');
  });

  it('should reject malformed authorization header', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'InvalidFormat')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('error', 'Unauthorized');
  });
});

// ─── Token Validation Tests ───────────────────────────────────────────────

describe('JWT Token Validation', () => {
  it('should have valid token structure', () => {
    const parts = authToken.split('.');
    expect(parts.length).toBe(3);
  });

  it('should include userId and email in token payload', () => {
    const payload = JSON.parse(
      Buffer.from(authToken.split('.')[1], 'base64').toString()
    );

    expect(payload).toHaveProperty('userId', userId);
    expect(payload).toHaveProperty('email', testUser.email);
    expect(payload).toHaveProperty('exp');
    expect(payload).toHaveProperty('iat');
  });
});
