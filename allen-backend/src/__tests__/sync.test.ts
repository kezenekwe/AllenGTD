import request from 'supertest';
import app from '../app';
import { query } from '../db/connection';

// ─── Test Data ────────────────────────────────────────────────────────────

const testUser = {
  name: 'Sync Test User',
  email: 'synctest@example.com',
  password: 'SyncTest123',
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

// ─── GET /api/sync Tests ──────────────────────────────────────────────────

describe('GET /api/sync', () => {
  beforeEach(async () => {
    // Clean up items before each test
    await query('DELETE FROM items WHERE user_id = $1', [userId]);
  });

  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get('/api/sync')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/sync')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('First Sync (No Token)', () => {
    it('should return all items on first sync', async () => {
      // Create some test items
      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Item 1', category: 'inbox' });

      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Item 2', category: 'nextActions' });

      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Item 3', category: 'projects' });

      // First sync (no since parameter)
      const response = await request(app)
        .get('/api/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('changes');
      expect(response.body).toHaveProperty('syncToken');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('count');
      expect(response.body.count).toBe(3);
      expect(response.body.changes.length).toBe(3);
    });

    it('should return empty array if no items exist', async () => {
      const response = await request(app)
        .get('/api/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.changes).toEqual([]);
      expect(response.body.count).toBe(0);
      expect(response.body.syncToken).toBeDefined();
    });
  });

  describe('Incremental Sync (With Token)', () => {
    it('should return only changes since token (ISO timestamp)', async () => {
      // Create initial item
      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Old Item', category: 'inbox' });

      // Get first sync token
      const firstSync = await request(app)
        .get('/api/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const syncToken = firstSync.body.syncToken;

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create new items after sync
      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'New Item 1', category: 'nextActions' });

      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'New Item 2', category: 'projects' });

      // Sync with token
      const response = await request(app)
        .get(`/api/sync?since=${syncToken}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.count).toBe(2); // Only new items
      expect(response.body.changes.every((item: any) => 
        item.text.includes('New Item')
      )).toBe(true);
    });

    it('should return only changes since token (Unix milliseconds)', async () => {
      // Create initial item
      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Old Item', category: 'inbox' });

      // Get current timestamp in Unix ms
      const syncTimestamp = Date.now();

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create new item
      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'New Item', category: 'nextActions' });

      // Sync with Unix timestamp
      const response = await request(app)
        .get(`/api/sync?since=${syncTimestamp}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.changes[0].text).toBe('New Item');
    });

    it('should return empty array if no changes since token', async () => {
      // Create item
      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Item', category: 'inbox' });

      // Get sync token
      const firstSync = await request(app)
        .get('/api/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Sync again with same token (no changes)
      const response = await request(app)
        .get(`/api/sync?since=${firstSync.body.syncToken}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.changes).toEqual([]);
      expect(response.body.count).toBe(0);
    });
  });

  describe('Token Validation', () => {
    it('should reject invalid ISO timestamp', async () => {
      const response = await request(app)
        .get('/api/sync?since=invalid-timestamp')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body.message).toContain('Invalid sync token format');
    });

    it('should reject future timestamp', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const response = await request(app)
        .get(`/api/sync?since=${futureDate.toISOString()}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain('cannot be in the future');
    });

    it('should accept valid old timestamp', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 7); // 7 days ago

      const response = await request(app)
        .get(`/api/sync?since=${oldDate.toISOString()}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('changes');
    });
  });

  describe('Change Types', () => {
    it('should include created items', async () => {
      const syncBefore = await request(app)
        .get('/api/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Create item
      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Created Item', category: 'inbox' });

      const syncAfter = await request(app)
        .get(`/api/sync?since=${syncBefore.body.syncToken}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(syncAfter.body.count).toBe(1);
      expect(syncAfter.body.changes[0].text).toBe('Created Item');
    });

    it('should include updated items', async () => {
      // Create item
      const createResponse = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Original', category: 'inbox' });

      const itemId = createResponse.body.data.id;

      // Get sync token
      const syncBefore = await request(app)
        .get('/api/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Update item
      await request(app)
        .patch(`/api/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Updated' });

      const syncAfter = await request(app)
        .get(`/api/sync?since=${syncBefore.body.syncToken}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(syncAfter.body.count).toBe(1);
      expect(syncAfter.body.changes[0].text).toBe('Updated');
    });

    it('should include deleted items', async () => {
      // Create item
      const createResponse = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'To Delete', category: 'inbox' });

      const itemId = createResponse.body.data.id;

      // Get sync token
      const syncBefore = await request(app)
        .get('/api/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Delete item
      await request(app)
        .delete(`/api/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const syncAfter = await request(app)
        .get(`/api/sync?since=${syncBefore.body.syncToken}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(syncAfter.body.count).toBe(1);
      expect(syncAfter.body.changes[0].status).toBe('deleted');
    });
  });

  describe('Response Format', () => {
    it('should return correct response structure', async () => {
      const response = await request(app)
        .get('/api/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('changes');
      expect(response.body).toHaveProperty('syncToken');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('count');
      expect(Array.isArray(response.body.changes)).toBe(true);
      expect(typeof response.body.syncToken).toBe('string');
      expect(typeof response.body.count).toBe('number');
    });

    it('should return items in chronological order', async () => {
      // Create items with delay
      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Item 1', category: 'inbox' });

      await new Promise(resolve => setTimeout(resolve, 50));

      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Item 2', category: 'inbox' });

      await new Promise(resolve => setTimeout(resolve, 50));

      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Item 3', category: 'inbox' });

      const response = await request(app)
        .get('/api/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const changes = response.body.changes;
      
      // Verify chronological order
      for (let i = 0; i < changes.length - 1; i++) {
        const current = new Date(changes[i].updated_at);
        const next = new Date(changes[i + 1].updated_at);
        expect(current.getTime()).toBeLessThanOrEqual(next.getTime());
      }
    });

    it('should generate new sync token on each request', async () => {
      const response1 = await request(app)
        .get('/api/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await new Promise(resolve => setTimeout(resolve, 100));

      const response2 = await request(app)
        .get('/api/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response1.body.syncToken).not.toBe(response2.body.syncToken);
    });
  });

  describe('Data Isolation', () => {
    it('should only return items for authenticated user', async () => {
      // Create items for test user
      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'User 1 Item', category: 'inbox' });

      // Create another user
      const otherUser = {
        name: 'Other Sync User',
        email: 'othersync@example.com',
        password: 'OtherSync123',
      };

      const otherResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(otherUser);

      const otherToken = otherResponse.body.token;
      const otherUserId = otherResponse.body.user.id;

      // Create items for other user
      await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ text: 'User 2 Item', category: 'inbox' });

      // Sync for original user
      const syncResponse = await request(app)
        .get('/api/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should only have user 1's item
      expect(syncResponse.body.count).toBe(1);
      expect(syncResponse.body.changes[0].text).toBe('User 1 Item');

      // Cleanup
      await query('DELETE FROM items WHERE user_id = $1', [otherUserId]);
      await query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });
  });
});

// ─── GET /api/sync/status Tests ───────────────────────────────────────────

describe('GET /api/sync/status', () => {
  beforeEach(async () => {
    // Clean up items before each test
    await query('DELETE FROM items WHERE user_id = $1', [userId]);
  });

  it('should return sync status', async () => {
    // Create test items
    await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ text: 'Item 1', category: 'inbox' });

    await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ text: 'Item 2', category: 'nextActions' });

    const response = await request(app)
      .get('/api/sync/status')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('totalItems', 2);
    expect(response.body).toHaveProperty('itemsByCategory');
    expect(response.body).toHaveProperty('itemsByStatus');
    expect(response.body).toHaveProperty('lastModified');
    expect(response.body).toHaveProperty('syncToken');
  });

  it('should return correct counts by category', async () => {
    await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ text: 'Inbox 1', category: 'inbox' });

    await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ text: 'Inbox 2', category: 'inbox' });

    await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ text: 'Next 1', category: 'nextActions' });

    const response = await request(app)
      .get('/api/sync/status')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.itemsByCategory.inbox).toBe(2);
    expect(response.body.itemsByCategory.nextActions).toBe(1);
  });

  it('should require authentication', async () => {
    const response = await request(app)
      .get('/api/sync/status')
      .expect(401);

    expect(response.body).toHaveProperty('error', 'Unauthorized');
  });
});
