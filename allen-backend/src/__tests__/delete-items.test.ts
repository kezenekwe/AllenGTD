import request from 'supertest';
import app from '../app';
import { query } from '../db/connection';

// ─── Test Data ────────────────────────────────────────────────────────────

const testUser = {
  name: 'DELETE Test User',
  email: 'deletetest@example.com',
  password: 'DeleteTest123',
};

let authToken: string;
let userId: string;
let testItemId: string;

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

// ─── DELETE /api/items/:id Tests ──────────────────────────────────────────

describe('DELETE /api/items/:id', () => {
  // Create a fresh item before each test
  beforeEach(async () => {
    const itemResponse = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        text: 'Test item for deletion',
        category: 'inbox',
      });

    testItemId = itemResponse.body.data.id;
  });

  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .delete(`/api/items/${testItemId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .delete(`/api/items/${testItemId}`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('Ownership Validation', () => {
    it('should only allow user to delete their own items', async () => {
      // Create another user
      const otherUser = {
        name: 'Other User',
        email: 'other-delete@example.com',
        password: 'OtherUser123',
      };

      const otherUserResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(otherUser);

      const otherUserId = otherUserResponse.body.user.id;
      const otherUserToken = otherUserResponse.body.token;

      // Try to delete original user's item with other user's token
      const response = await request(app)
        .delete(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');

      // Verify item was NOT deleted
      const checkItem = await query(
        'SELECT status FROM items WHERE id = $1',
        [testItemId]
      );
      expect(checkItem.rows[0].status).toBe('active'); // Still active

      // Cleanup
      await query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });

    it('should return 404 for non-existent item', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .delete(`/api/items/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .delete('/api/items/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body.message).toContain('Invalid item ID format');
    });
  });

  describe('Soft Delete', () => {
    it('should soft delete item by setting status to deleted', async () => {
      const response = await request(app)
        .delete(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Item deleted successfully');

      // Verify in database - status should be 'deleted'
      const dbItem = await query(
        'SELECT status, updated_at FROM items WHERE id = $1',
        [testItemId]
      );

      expect(dbItem.rows.length).toBe(1); // Item still exists
      expect(dbItem.rows[0].status).toBe('deleted'); // Status changed
    });

    it('should update updated_at timestamp when deleting', async () => {
      // Get original updated_at
      const before = await query(
        'SELECT updated_at FROM items WHERE id = $1',
        [testItemId]
      );
      const beforeTime = new Date(before.rows[0].updated_at);

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Delete item
      await request(app)
        .delete(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get new updated_at
      const after = await query(
        'SELECT updated_at FROM items WHERE id = $1',
        [testItemId]
      );
      const afterTime = new Date(after.rows[0].updated_at);

      expect(afterTime.getTime()).toBeGreaterThan(beforeTime.getTime());
    });

    it('should not actually remove item from database', async () => {
      await request(app)
        .delete(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify item still exists in database
      const dbItem = await query(
        'SELECT id FROM items WHERE id = $1',
        [testItemId]
      );

      expect(dbItem.rows.length).toBe(1); // Still exists
    });

    it('should not show deleted item in default GET query', async () => {
      // Delete the item
      await request(app)
        .delete(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get all items (default shows only active)
      const response = await request(app)
        .get('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Deleted item should not appear
      const deletedItem = response.body.data.find(
        (item: any) => item.id === testItemId
      );

      expect(deletedItem).toBeUndefined();
    });

    it('should show deleted item when filtering by status=deleted', async () => {
      // Delete the item
      await request(app)
        .delete(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get deleted items
      const response = await request(app)
        .get('/api/items?status=deleted')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Deleted item should appear
      const deletedItem = response.body.data.find(
        (item: any) => item.id === testItemId
      );

      expect(deletedItem).toBeDefined();
      expect(deletedItem.status).toBe('deleted');
    });

    it('should be able to restore deleted item by updating status', async () => {
      // Delete the item
      await request(app)
        .delete(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Restore by updating status back to active
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'active' })
        .expect(200);

      expect(response.body.data.status).toBe('active');

      // Should now appear in default GET query
      const getResponse = await request(app)
        .get('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const restoredItem = getResponse.body.data.find(
        (item: any) => item.id === testItemId
      );

      expect(restoredItem).toBeDefined();
    });
  });

  describe('Response Format', () => {
    it('should return 200 status code', async () => {
      await request(app)
        .delete(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should return success message', async () => {
      const response = await request(app)
        .delete(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Item deleted successfully');
    });

    it('should not return item data (only message)', async () => {
      const response = await request(app)
        .delete(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).not.toHaveProperty('data');
    });
  });

  describe('Idempotency', () => {
    it('should return 404 when deleting already deleted item', async () => {
      // Delete once
      await request(app)
        .delete(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Try to delete again - should fail because item won't be found
      // (The service only finds items with status != deleted)
      const response = await request(app)
        .delete(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
    });
  });

  describe('Edge Cases', () => {
    it('should handle deleting item with associated data', async () => {
      // Create item with all fields populated
      const complexItem = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Complex item',
          category: 'projects',
          nextAction: 'Some action',
          waitingFor: 'Someone',
          projectPlan: 'Detailed plan',
        });

      const complexItemId = complexItem.body.data.id;

      // Delete it
      const response = await request(app)
        .delete(`/api/items/${complexItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Item deleted successfully');

      // Verify all data is still there, just marked deleted
      const dbItem = await query(
        'SELECT * FROM items WHERE id = $1',
        [complexItemId]
      );

      expect(dbItem.rows[0].status).toBe('deleted');
      expect(dbItem.rows[0].next_action).toBe('Some action');
      expect(dbItem.rows[0].waiting_for).toBe('Someone');
      expect(dbItem.rows[0].project_plan).toBe('Detailed plan');
    });

    it('should handle deleting completed item', async () => {
      // First mark item as completed
      await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' });

      // Then delete it
      const response = await request(app)
        .delete(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Item deleted successfully');

      // Verify status changed to deleted
      const dbItem = await query(
        'SELECT status FROM items WHERE id = $1',
        [testItemId]
      );

      expect(dbItem.rows[0].status).toBe('deleted');
    });
  });

  describe('Multiple Deletes', () => {
    it('should handle deleting multiple items', async () => {
      // Create multiple items
      const item1 = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Item 1', category: 'inbox' });

      const item2 = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Item 2', category: 'inbox' });

      const item3 = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Item 3', category: 'inbox' });

      // Delete all three
      await request(app)
        .delete(`/api/items/${item1.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app)
        .delete(`/api/items/${item2.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app)
        .delete(`/api/items/${item3.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify all are deleted
      const deletedItems = await query(
        'SELECT COUNT(*) FROM items WHERE user_id = $1 AND status = $2',
        [userId, 'deleted']
      );

      expect(parseInt(deletedItems.rows[0].count)).toBeGreaterThanOrEqual(3);
    });
  });
});
