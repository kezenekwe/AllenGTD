import request from 'supertest';
import app from '../app';
import { query } from '../db/connection';

// ─── Test Data ────────────────────────────────────────────────────────────

const testUser = {
  name: 'PATCH Test User',
  email: 'patchtest@example.com',
  password: 'PatchTest123',
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

  // Create a test item to update
  const itemResponse = await request(app)
    .post('/api/items')
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      text: 'Test item for updating',
      category: 'inbox',
    });

  testItemId = itemResponse.body.data.id;
});

afterAll(async () => {
  // Clean up test items
  await query('DELETE FROM items WHERE user_id = $1', [userId]);
  
  // Clean up test user
  await query('DELETE FROM users WHERE email = $1', [testUser.email]);
});

// ─── PATCH /api/items/:id Tests ───────────────────────────────────────────

describe('PATCH /api/items/:id', () => {
  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .send({ text: 'Updated text' })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', 'Bearer invalid-token')
        .send({ text: 'Updated text' })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('Ownership Validation', () => {
    it('should only allow user to update their own items', async () => {
      // Create another user
      const otherUser = {
        name: 'Other User',
        email: 'other-patch@example.com',
        password: 'OtherUser123',
      };

      const otherUserResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(otherUser);

      const otherUserId = otherUserResponse.body.user.id;
      const otherUserToken = otherUserResponse.body.token;

      // Try to update original user's item with other user's token
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ text: 'Trying to update someone elses item' })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');

      // Verify item was NOT updated
      const checkItem = await query(
        'SELECT text FROM items WHERE id = $1',
        [testItemId]
      );
      expect(checkItem.rows[0].text).not.toBe('Trying to update someone elses item');

      // Cleanup
      await query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });

    it('should return 404 for non-existent item', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .patch(`/api/items/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Updated text' })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .patch('/api/items/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Updated text' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body.message).toContain('Invalid item ID format');
    });
  });

  describe('Update Category', () => {
    it('should update item category from inbox to nextActions', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ category: 'nextActions' })
        .expect(200);

      expect(response.body.message).toBe('Item updated successfully');
      expect(response.body.data.category).toBe('nextActions');
      expect(response.body.data.id).toBe(testItemId);

      // Verify in database
      const dbItem = await query(
        'SELECT category FROM items WHERE id = $1',
        [testItemId]
      );
      expect(dbItem.rows[0].category).toBe('nextActions');
    });

    it('should update category to projects', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ category: 'projects' })
        .expect(200);

      expect(response.body.data.category).toBe('projects');
    });

    it('should update category to waiting', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ category: 'waiting' })
        .expect(200);

      expect(response.body.data.category).toBe('waiting');
    });

    it('should update category to someday', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ category: 'someday' })
        .expect(200);

      expect(response.body.data.category).toBe('someday');
    });

    it('should update category to reference', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ category: 'reference' })
        .expect(200);

      expect(response.body.data.category).toBe('reference');
    });

    it('should reject invalid category', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ category: 'invalid-category' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body.message).toContain('Invalid category');
    });
  });

  describe('Update Text', () => {
    it('should update item text', async () => {
      const newText = 'Updated item text';

      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: newText })
        .expect(200);

      expect(response.body.data.text).toBe(newText);

      // Verify in database
      const dbItem = await query(
        'SELECT text FROM items WHERE id = $1',
        [testItemId]
      );
      expect(dbItem.rows[0].text).toBe(newText);
    });

    it('should handle special characters in text', async () => {
      const specialText = 'Special chars: !@#$%^&*()_+-=[]{}|;:\'",.<>?/';

      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: specialText })
        .expect(200);

      expect(response.body.data.text).toBe(specialText);
    });

    it('should handle unicode characters', async () => {
      const unicodeText = '测试 テスト 🎉 émojis café';

      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: unicodeText })
        .expect(200);

      expect(response.body.data.text).toBe(unicodeText);
    });
  });

  describe('Update Status', () => {
    it('should update status to completed', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' })
        .expect(200);

      expect(response.body.data.status).toBe('completed');
    });

    it('should update status back to active', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'active' })
        .expect(200);

      expect(response.body.data.status).toBe('active');
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body.message).toContain('Invalid status');
    });
  });

  describe('Update Optional Fields', () => {
    it('should update nextAction field', async () => {
      const nextAction = 'Call John tomorrow';

      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ nextAction })
        .expect(200);

      expect(response.body.data.next_action).toBe(nextAction);
    });

    it('should update waitingFor field', async () => {
      const waitingFor = 'Waiting for Sarah';

      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ waitingFor })
        .expect(200);

      expect(response.body.data.waiting_for).toBe(waitingFor);
    });

    it('should update projectPlan field', async () => {
      const projectPlan = 'Step 1: Planning\nStep 2: Execution\nStep 3: Review';

      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectPlan })
        .expect(200);

      expect(response.body.data.project_plan).toBe(projectPlan);
    });

    it('should update hasCalendar field', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ hasCalendar: true })
        .expect(200);

      expect(response.body.data.has_calendar).toBe(true);
    });

    it('should clear nextAction by setting to null', async () => {
      // First set it
      await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ nextAction: 'Some action' });

      // Then clear it
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ nextAction: null })
        .expect(200);

      expect(response.body.data.next_action).toBeNull();
    });
  });

  describe('Update Multiple Fields', () => {
    it('should update multiple fields at once', async () => {
      const updates = {
        text: 'Multi-field update',
        category: 'projects',
        nextAction: 'Start planning',
        projectPlan: 'Detailed plan here',
      };

      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.data.text).toBe(updates.text);
      expect(response.body.data.category).toBe(updates.category);
      expect(response.body.data.next_action).toBe(updates.nextAction);
      expect(response.body.data.project_plan).toBe(updates.projectPlan);
    });

    it('should update category and status together', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          category: 'inbox',
          status: 'completed',
        })
        .expect(200);

      expect(response.body.data.category).toBe('inbox');
      expect(response.body.data.status).toBe('completed');
    });
  });

  describe('Timestamps', () => {
    it('should update updated_at timestamp', async () => {
      // Get current item
      const before = await request(app)
        .get(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const beforeUpdatedAt = new Date(before.body.data.updated_at);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update item
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Timestamp test' })
        .expect(200);

      const afterUpdatedAt = new Date(response.body.data.updated_at);

      expect(afterUpdatedAt.getTime()).toBeGreaterThan(beforeUpdatedAt.getTime());
    });

    it('should not change created_at timestamp', async () => {
      // Get original created_at
      const before = await request(app)
        .get(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const originalCreatedAt = before.body.data.created_at;

      // Update item
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Created timestamp test' })
        .expect(200);

      expect(response.body.data.created_at).toBe(originalCreatedAt);
    });
  });

  describe('Response Format', () => {
    it('should return 200 status code', async () => {
      await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Status code test' })
        .expect(200);
    });

    it('should return success message', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Message test' })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Item updated successfully');
    });

    it('should return complete updated item', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Complete item test' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('user_id');
      expect(response.body.data).toHaveProperty('text');
      expect(response.body.data).toHaveProperty('category');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('created_at');
      expect(response.body.data).toHaveProperty('updated_at');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty update object', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      // Should return item unchanged (except updated_at)
      expect(response.body.data.id).toBe(testItemId);
    });

    it('should ignore unknown fields', async () => {
      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Valid update',
          unknownField: 'This should be ignored',
          anotherUnknown: 123,
        })
        .expect(200);

      expect(response.body.data.text).toBe('Valid update');
      expect(response.body.data).not.toHaveProperty('unknownField');
      expect(response.body.data).not.toHaveProperty('anotherUnknown');
    });

    it('should not allow updating user_id', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ user_id: fakeUserId })
        .expect(200);

      // user_id should remain unchanged
      expect(response.body.data.user_id).toBe(userId);
      expect(response.body.data.user_id).not.toBe(fakeUserId);
    });

    it('should not allow updating id', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .patch(`/api/items/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ id: fakeId })
        .expect(200);

      // id should remain unchanged
      expect(response.body.data.id).toBe(testItemId);
      expect(response.body.data.id).not.toBe(fakeId);
    });
  });
});
