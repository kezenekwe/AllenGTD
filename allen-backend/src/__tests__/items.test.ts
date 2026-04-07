import request from 'supertest';
import app from '../app';
import { query } from '../db/connection';

// ─── Test Data ────────────────────────────────────────────────────────────

const testUser = {
  name: 'Items Test User',
  email: 'items@example.com',
  password: 'ItemsTest123',
};

let authToken: string;
let userId: string;
let testItems: any[] = [];

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

  // Create test items
  const itemsToCreate = [
    { text: 'Inbox Item 1', category: 'inbox', status: 'active' },
    { text: 'Inbox Item 2', category: 'inbox', status: 'active' },
    { text: 'Next Action 1', category: 'nextActions', status: 'active' },
    { text: 'Project 1', category: 'projects', status: 'active' },
    { text: 'Completed Item', category: 'inbox', status: 'completed' },
  ];

  for (const item of itemsToCreate) {
    const result = await query(
      `INSERT INTO items (user_id, text, category, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id, text, category, status`,
      [userId, item.text, item.category, item.status]
    );
    testItems.push(result.rows[0]);
  }
});

afterAll(async () => {
  // Clean up test items
  await query('DELETE FROM items WHERE user_id = $1', [userId]);
  
  // Clean up test user
  await query('DELETE FROM users WHERE email = $1', [testUser.email]);
});

// ─── GET /api/items Tests ─────────────────────────────────────────────────

describe('GET /api/items', () => {
  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get('/api/items')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/items')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('Get All Items', () => {
    it('should get all active items for authenticated user', async () => {
      const response = await request(app)
        .get('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('count');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Should only return active items (4 active, 1 completed)
      expect(response.body.count).toBe(4);
      
      // Check each item has required fields
      response.body.data.forEach((item: any) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('user_id', userId);
        expect(item).toHaveProperty('text');
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('status', 'active');
        expect(item).toHaveProperty('created_at');
        expect(item).toHaveProperty('updated_at');
      });
    });

    it('should return empty array if user has no items', async () => {
      // Create a new user with no items
      const newUser = {
        name: 'Empty User',
        email: 'empty@example.com',
        password: 'EmptyUser123',
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(newUser);

      const newUserToken = registerResponse.body.token;

      const response = await request(app)
        .get('/api/items')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);

      // Cleanup
      await query('DELETE FROM users WHERE email = $1', [newUser.email]);
    });
  });

  describe('Filter by Category', () => {
    it('should filter items by category=inbox', async () => {
      const response = await request(app)
        .get('/api/items?category=inbox')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.count).toBe(2); // 2 active inbox items
      expect(response.body.filters.category).toBe('inbox');
      
      response.body.data.forEach((item: any) => {
        expect(item.category).toBe('inbox');
        expect(item.status).toBe('active');
      });
    });

    it('should filter items by category=next', async () => {
      const response = await request(app)
        .get('/api/items?category=nextActions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.filters.category).toBe('nextActions');

      response.body.data.forEach((item: any) => {
        expect(item.category).toBe('nextActions');
      });
    });

    it('should filter items by category=projects', async () => {
      const response = await request(app)
        .get('/api/items?category=projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.filters.category).toBe('projects');
    });

    it('should return 400 for invalid category', async () => {
      const response = await request(app)
        .get('/api/items?category=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body.message).toContain('Invalid category');
    });

    it('should accept all valid categories', async () => {
      const validCategories = ['inbox', 'nextActions', 'projects', 'waiting', 'someday', 'reference'];

      for (const category of validCategories) {
        const response = await request(app)
          .get(`/api/items?category=${category}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.filters.category).toBe(category);
      }
    });
  });

  describe('Filter by Status', () => {
    it('should filter items by status=active', async () => {
      const response = await request(app)
        .get('/api/items?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.count).toBe(4);
      
      response.body.data.forEach((item: any) => {
        expect(item.status).toBe('active');
      });
    });

    it('should filter items by status=completed', async () => {
      const response = await request(app)
        .get('/api/items?status=completed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      
      response.body.data.forEach((item: any) => {
        expect(item.status).toBe('completed');
      });
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .get('/api/items?status=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body.message).toContain('Invalid status');
    });
  });

  describe('Combined Filters', () => {
    it('should filter by both category and status', async () => {
      const response = await request(app)
        .get('/api/items?category=inbox&status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.filters.category).toBe('inbox');
      expect(response.body.filters.status).toBe('active');
      
      response.body.data.forEach((item: any) => {
        expect(item.category).toBe('inbox');
        expect(item.status).toBe('active');
      });
    });

    it('should filter inbox completed items', async () => {
      const response = await request(app)
        .get('/api/items?category=inbox&status=completed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.data[0].category).toBe('inbox');
      expect(response.body.data[0].status).toBe('completed');
    });
  });

  describe('Data Isolation', () => {
    it('should only return items belonging to authenticated user', async () => {
      // Create another user
      const otherUser = {
        name: 'Other User',
        email: 'other@example.com',
        password: 'OtherUser123',
      };

      const otherUserResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(otherUser);

      const otherUserId = otherUserResponse.body.user.id;

      // Create item for other user
      await query(
        `INSERT INTO items (user_id, text, category, status)
         VALUES ($1, $2, $3, $4)`,
        [otherUserId, 'Other User Item', 'inbox', 'active']
      );

      // Get items for original user
      const response = await request(app)
        .get('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should not include other user's item
      const otherUserItems = response.body.data.filter(
        (item: any) => item.text === 'Other User Item'
      );

      expect(otherUserItems.length).toBe(0);

      // All items should belong to test user
      response.body.data.forEach((item: any) => {
        expect(item.user_id).toBe(userId);
      });

      // Cleanup
      await query('DELETE FROM items WHERE user_id = $1', [otherUserId]);
      await query('DELETE FROM users WHERE email = $1', [otherUser.email]);
    });
  });

  describe('Response Format', () => {
    it('should return items in correct format', async () => {
      const response = await request(app)
        .get('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('filters');
      
      expect(typeof response.body.count).toBe('number');
      expect(response.body.filters).toHaveProperty('category');
      expect(response.body.filters).toHaveProperty('status');
    });

    it('should order items by created_at descending', async () => {
      const response = await request(app)
        .get('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const items = response.body.data;
      
      for (let i = 0; i < items.length - 1; i++) {
        const current = new Date(items[i].created_at);
        const next = new Date(items[i + 1].created_at);
        
        // Current item should be newer or equal to next
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });
  });
});

// ─── GET /api/items/:id Tests ─────────────────────────────────────────────

describe('GET /api/items/:id', () => {
  it('should get a single item by ID', async () => {
    const itemId = testItems[0].id;

    const response = await request(app)
      .get(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data.id).toBe(itemId);
    expect(response.body.data.user_id).toBe(userId);
  });

  it('should return 404 for non-existent item', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const response = await request(app)
      .get(`/api/items/${fakeId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);

    expect(response.body).toHaveProperty('error', 'Not Found');
  });

  it('should return 400 for invalid UUID format', async () => {
    const response = await request(app)
      .get('/api/items/invalid-id')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Validation Error');
    expect(response.body.message).toContain('Invalid item ID format');
  });

  it('should return 401 without auth token', async () => {
    const itemId = testItems[0].id;

    const response = await request(app)
      .get(`/api/items/${itemId}`)
      .expect(401);

    expect(response.body).toHaveProperty('error', 'Unauthorized');
  });
});
