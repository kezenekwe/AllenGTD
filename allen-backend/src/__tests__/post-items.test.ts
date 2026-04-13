import request from 'supertest';
import app from '../app';
import { query } from '../db/connection';

// ─── Test Data ────────────────────────────────────────────────────────────

const testUser = {
  name: 'POST Test User',
  email: 'posttest@example.com',
  password: 'PostTest123',
};

let authToken: string;
let userId: string;

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
  // Clean up test items
  await query('DELETE FROM items WHERE user_id = $1', [userId]);
  
  // Clean up test user
  await query('DELETE FROM users WHERE email = $1', [testUser.email]);
});

// ─── POST /api/items Tests ────────────────────────────────────────────────

describe('POST /api/items', () => {
  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post('/api/items')
        .send({
          text: 'Test item',
          category: 'inbox',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .post('/api/items')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          text: 'Test item',
          category: 'inbox',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('Validation', () => {
    it('should return 400 if text is missing', async () => {
      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          category: 'inbox',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body.message).toContain('Text');
    });

    it('should return 400 if category is missing', async () => {
      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Test item',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body.message).toContain('category');
    });

    it('should return 400 if both text and category are missing', async () => {
      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for invalid category', async () => {
      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Test item',
          category: 'invalid-category',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body.message).toContain('Invalid category');
    });

    it('should accept empty string for text and reject it', async () => {
      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: '',
          category: 'inbox',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should accept all valid categories', async () => {
      const validCategories = ['inbox', 'nextActions', 'projects', 'waiting', 'someday', 'reference'];

      for (const category of validCategories) {
        const response = await request(app)
          .post('/api/items')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            text: `Test item for ${category}`,
            category,
          })
          .expect(201);

        expect(response.body.data.category).toBe(category);
      }
    });
  });

  describe('Create Item', () => {
    it('should create a basic inbox item', async () => {
      const itemData = {
        text: 'Buy groceries',
        category: 'inbox',
      };

      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send(itemData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Item created successfully');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.text).toBe(itemData.text);
      expect(response.body.data.category).toBe(itemData.category);
      expect(response.body.data.user_id).toBe(userId);
      expect(response.body.data.status).toBe('active');
      expect(response.body.data).toHaveProperty('created_at');
      expect(response.body.data).toHaveProperty('updated_at');
    });

    it('should create a next action item with nextAction field', async () => {
      const itemData = {
        text: 'Review quarterly report',
        category: 'nextActions',
        nextAction: 'Schedule review meeting',
      };

      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send(itemData)
        .expect(201);

      expect(response.body.data.text).toBe(itemData.text);
      expect(response.body.data.category).toBe('nextActions');
      expect(response.body.data.next_action).toBe(itemData.nextAction);
    });

    it('should create a waiting item with waitingFor field', async () => {
      const itemData = {
        text: 'Get approval from manager',
        category: 'waiting',
        waitingFor: 'Sarah from HR',
      };

      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send(itemData)
        .expect(201);

      expect(response.body.data.text).toBe(itemData.text);
      expect(response.body.data.category).toBe('waiting');
      expect(response.body.data.waiting_for).toBe(itemData.waitingFor);
    });

    it('should create a project item with projectPlan field', async () => {
      const itemData = {
        text: 'Build new website',
        category: 'projects',
        projectPlan: 'Step 1: Research\nStep 2: Design\nStep 3: Develop',
      };

      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send(itemData)
        .expect(201);

      expect(response.body.data.text).toBe(itemData.text);
      expect(response.body.data.category).toBe('projects');
      expect(response.body.data.project_plan).toBe(itemData.projectPlan);
    });

    it('should set default values for optional fields', async () => {
      const itemData = {
        text: 'Simple item',
        category: 'inbox',
      };

      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send(itemData)
        .expect(201);

      expect(response.body.data.next_action).toBeNull();
      expect(response.body.data.waiting_for).toBeNull();
      expect(response.body.data.project_plan).toBeNull();
      expect(response.body.data.has_calendar).toBe(false);
      expect(response.body.data.status).toBe('active');
    });

    it('should generate a unique UUID for each item', async () => {
      const response1 = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Item 1', category: 'inbox' })
        .expect(201);

      const response2 = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Item 2', category: 'inbox' })
        .expect(201);

      expect(response1.body.data.id).not.toBe(response2.body.data.id);
      
      // Verify UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(response1.body.data.id).toMatch(uuidRegex);
      expect(response2.body.data.id).toMatch(uuidRegex);
    });
  });

  describe('Database Verification', () => {
    it('should persist item in database', async () => {
      const itemData = {
        text: 'Database test item',
        category: 'inbox',
      };

      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send(itemData)
        .expect(201);

      const itemId = response.body.data.id;

      // Verify in database
      const result = await query(
        'SELECT * FROM items WHERE id = $1',
        [itemId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].text).toBe(itemData.text);
      expect(result.rows[0].category).toBe(itemData.category);
      expect(result.rows[0].user_id).toBe(userId);
      expect(result.rows[0].status).toBe('active');
    });

    it('should set timestamps correctly', async () => {
      const beforeCreate = new Date();

      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Timestamp test',
          category: 'inbox',
        })
        .expect(201);

      const afterCreate = new Date();

      const createdAt = new Date(response.body.data.created_at);
      const updatedAt = new Date(response.body.data.updated_at);

      // created_at should be between before and after
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime() - 1000);
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime() + 1000);

      // created_at and updated_at should be the same initially
      expect(createdAt.getTime()).toBe(updatedAt.getTime());
    });

    it('should link item to authenticated user', async () => {
      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'User link test',
          category: 'inbox',
        })
        .expect(201);

      const itemId = response.body.data.id;

      // Verify user_id in database
      const result = await query(
        'SELECT user_id FROM items WHERE id = $1',
        [itemId]
      );

      expect(result.rows[0].user_id).toBe(userId);
    });
  });

  describe('Response Format', () => {
    it('should return 201 status code', async () => {
      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Status code test',
          category: 'inbox',
        })
        .expect(201);
    });

    it('should return correct response structure', async () => {
      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Structure test',
          category: 'inbox',
        })
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.data).toBe('object');
    });

    it('should return all item fields', async () => {
      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Fields test',
          category: 'inbox',
        })
        .expect(201);

      const item = response.body.data;

      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('user_id');
      expect(item).toHaveProperty('text');
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('next_action');
      expect(item).toHaveProperty('waiting_for');
      expect(item).toHaveProperty('project_plan');
      expect(item).toHaveProperty('has_calendar');
      expect(item).toHaveProperty('created_at');
      expect(item).toHaveProperty('updated_at');
    });
  });

  describe('Data Isolation', () => {
    it('should only create items for authenticated user', async () => {
      // Create another user
      const otherUser = {
        name: 'Other User',
        email: 'other-post@example.com',
        password: 'OtherUser123',
      };

      const otherUserResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(otherUser);

      const otherUserId = otherUserResponse.body.user.id;

      // Create item with original user's token
      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Isolation test',
          category: 'inbox',
        })
        .expect(201);

      // Verify item belongs to original user, not other user
      expect(response.body.data.user_id).toBe(userId);
      expect(response.body.data.user_id).not.toBe(otherUserId);

      // Cleanup
      await query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });
  });

  describe('Special Characters and Long Text', () => {
    it('should handle special characters in text', async () => {
      const itemData = {
        text: 'Test with special chars: !@#$%^&*()_+-=[]{}|;:\'",.<>?/`~',
        category: 'inbox',
      };

      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send(itemData)
        .expect(201);

      expect(response.body.data.text).toBe(itemData.text);
    });

    it('should handle unicode characters', async () => {
      const itemData = {
        text: '测试 テスト 🎉 émojis café',
        category: 'inbox',
      };

      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send(itemData)
        .expect(201);

      expect(response.body.data.text).toBe(itemData.text);
    });

    it('should handle long text', async () => {
      const longText = 'A'.repeat(5000); // 5000 character string

      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: longText,
          category: 'inbox',
        })
        .expect(201);

      expect(response.body.data.text).toBe(longText);
      expect(response.body.data.text.length).toBe(5000);
    });

    it('should handle multiline text', async () => {
      const multilineText = 'Line 1\nLine 2\nLine 3';

      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: multilineText,
          category: 'inbox',
        })
        .expect(201);

      expect(response.body.data.text).toBe(multilineText);
    });
  });

  describe('Edge Cases', () => {
    it('should reject non-JSON request body', async () => {
      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'text/plain')
        .send('not json')
        .expect(400);

      // Express should handle this before our validation
    });

    it('should handle null values for optional fields', async () => {
      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Null fields test',
          category: 'inbox',
          nextAction: null,
          waitingFor: null,
          projectPlan: null,
        })
        .expect(201);

      expect(response.body.data.next_action).toBeNull();
      expect(response.body.data.waiting_for).toBeNull();
      expect(response.body.data.project_plan).toBeNull();
    });
  });
});
