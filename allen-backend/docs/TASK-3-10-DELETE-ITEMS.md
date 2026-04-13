# Task 3.10: DELETE /api/items/:id

Complete implementation of item deletion endpoint with soft delete and ownership validation.

## 📋 Overview

**Endpoint:** `DELETE /api/items/:id`

**Purpose:** Delete (soft delete) GTD items for the authenticated user

**Features:**
- ✅ Validate ownership (item belongs to user)
- ✅ Soft delete (set status='deleted')
- ✅ Update updated_at timestamp
- ✅ Return success message
- ✅ Item remains in database (soft delete)
- ✅ Protected route (requires authentication)

---

## 🔄 Soft Delete vs Hard Delete

### Soft Delete (Implemented)

**What it does:**
- Sets `status = 'deleted'`
- Updates `updated_at` timestamp
- **Keeps** item in database
- Item can be restored

**Why soft delete?**
- ✅ Data recovery possible
- ✅ Audit trail preserved
- ✅ Undo functionality
- ✅ Analytics on deleted items
- ✅ Accidental deletion protection

### Hard Delete (Available but not default)

**What it does:**
- Permanently removes from database
- Cannot be recovered
- Use with caution

**When to use:**
- GDPR compliance (user data deletion)
- Database maintenance
- Explicit permanent deletion

---

## 📡 API Endpoint

### DELETE /api/items/:id

**Description:** Soft delete an item

**Authentication:** Required

**Parameters:**
- `id` (path): Item UUID

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/items/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "message": "Item deleted successfully"
}
```

**Note:** No item data is returned, only a success message.

---

## ❌ Error Responses

### 400 - Invalid UUID Format

```json
{
  "error": "Validation Error",
  "message": "Invalid item ID format"
}
```

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/items/invalid-id \
  -H "Authorization: Bearer <token>"
```

---

### 401 - Not Authenticated

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/items/<item-id>
# (no Authorization header)
```

---

### 404 - Item Not Found or Not Owned

```json
{
  "error": "Not Found",
  "message": "Item not found"
}
```

This error occurs when:
- Item doesn't exist
- Item belongs to a different user (ownership validation)
- Item was already deleted (cannot delete twice)

---

### 500 - Server Error

```json
{
  "error": "Internal Server Error",
  "message": "Failed to delete item"
}
```

---

## 🛢️ Database Operations

### Soft Delete SQL

```sql
UPDATE items
SET status = 'deleted', 
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND user_id = $2
RETURNING id;
```

**Result:**
- Item remains in database
- `status` changed to 'deleted'
- `updated_at` updated
- All other data preserved

### Before Delete

```sql
SELECT * FROM items WHERE id = 'item-id';
```

| id | user_id | text | category | status | updated_at |
|----|---------|------|----------|--------|------------|
| uuid | user-uuid | "Buy milk" | inbox | active | 2025-01-15 10:00 |

### After Delete

```sql
SELECT * FROM items WHERE id = 'item-id';
```

| id | user_id | text | category | status | updated_at |
|----|---------|------|----------|--------|------------|
| uuid | user-uuid | "Buy milk" | inbox | **deleted** | 2025-01-15 **11:30** |

---

## 🔒 Ownership Validation

### How It Works

The `deleteItem` service function includes `user_id` in the WHERE clause:

```sql
UPDATE items
SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND user_id = $2
RETURNING id;
```

**Security:**
- Users can only delete their own items
- Attempting to delete another user's item returns 404
- No information is leaked about items belonging to others

**Example:**
```typescript
// User A tries to delete User B's item
DELETE /api/items/user-b-item-id
Authorization: Bearer user-a-token

// Response: 404 Not Found
// Item is not affected even though it exists
```

---

## 🔍 Querying Deleted Items

### Default Behavior

By default, GET requests only return **active** items:

```bash
curl -X GET http://localhost:3000/api/items \
  -H "Authorization: Bearer <token>"

# Returns: Only items with status='active'
```

### Get Deleted Items

To see deleted items, use the `status` filter:

```bash
curl -X GET "http://localhost:3000/api/items?status=deleted" \
  -H "Authorization: Bearer <token>"

# Returns: Only items with status='deleted'
```

### Get All Items (Active + Deleted)

You would need to make two requests or modify the API to support `status=all`.

---

## ♻️ Restoring Deleted Items

Deleted items can be restored by updating their status:

```bash
curl -X PATCH http://localhost:3000/api/items/<item-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active"
  }'
```

**Result:**
- Item status changes from 'deleted' to 'active'
- Item appears in default GET queries again
- All data is preserved (text, category, etc.)

---

## 🧪 Testing

### Automated Tests (Jest)

Run the test suite:
```bash
cd allen-backend
npm test delete-items.test.ts
```

**Test Coverage:**
- ✅ Authentication (2 tests)
- ✅ Ownership validation (3 tests)
- ✅ Soft delete (6 tests)
- ✅ Response format (3 tests)
- ✅ Idempotency (1 test)
- ✅ Edge cases (2 tests)
- ✅ Multiple deletes (1 test)

**Total: 18 comprehensive tests**

### Manual Testing (Bash Script)

Make executable and run:
```bash
chmod +x test-delete-items.sh
./test-delete-items.sh
```

**Tests Included:**
1. Delete item (soft delete) ✅
2. Verify item marked as deleted ✅
3. Delete non-existent item ❌ (404)
4. Invalid UUID ❌ (400)
5. No authentication ❌ (401)
6. Delete already deleted item ❌ (404)
7. Restore deleted item ✅
8. Delete complex item ✅
9. Count active vs deleted items ✅

---

## 💻 Usage Examples

### JavaScript/TypeScript

```typescript
async function deleteItem(token: string, itemId: string) {
  const response = await fetch(
    `http://localhost:3000/api/items/${itemId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const { message } = await response.json();
  return message; // "Item deleted successfully"
}

// Usage
await deleteItem(token, itemId);
console.log('Item deleted');
```

---

### React Native

```typescript
import { Alert } from 'react-native';

async function handleDelete(itemId: string) {
  Alert.alert(
    'Delete Item',
    'Are you sure you want to delete this item?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getAuthToken();
            
            const response = await fetch(
              `http://localhost:3000/api/items/${itemId}`,
              {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              }
            );

            if (!response.ok) {
              const error = await response.json();
              Alert.alert('Error', error.message);
              return;
            }

            Alert.alert('Success', 'Item deleted');
            // Refresh the list
            await fetchItems();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete item');
          }
        },
      },
    ]
  );
}
```

---

### With Undo Functionality

```typescript
async function deleteWithUndo(itemId: string) {
  // Store the item ID for potential undo
  const deletedItemId = itemId;
  
  // Delete the item
  await deleteItem(token, itemId);
  
  // Show undo notification
  showNotification({
    message: 'Item deleted',
    action: {
      label: 'Undo',
      onPress: async () => {
        // Restore the item
        await fetch(
          `http://localhost:3000/api/items/${deletedItemId}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'active' }),
          }
        );
        
        showNotification({ message: 'Item restored' });
      },
    },
    duration: 5000, // 5 seconds to undo
  });
}
```

---

## 🎯 Common Use Cases

### Delete Completed Items

```typescript
// Get all completed items
const completed = await fetch(
  'http://localhost:3000/api/items?status=completed',
  { headers: { 'Authorization': `Bearer ${token}` } }
);

const items = await completed.json();

// Delete each one
for (const item of items.data) {
  await deleteItem(token, item.id);
}
```

### Bulk Delete

```typescript
async function bulkDelete(itemIds: string[]) {
  const results = await Promise.allSettled(
    itemIds.map(id => deleteItem(token, id))
  );
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  return { successful, failed };
}

// Usage
const result = await bulkDelete([id1, id2, id3]);
console.log(`Deleted ${result.successful} items, ${result.failed} failed`);
```

### Clean Up Old Deleted Items

```typescript
// Hard delete items that have been soft deleted for > 30 days
// (Would need to add created_at/deleted_at timestamp logic)
async function cleanupOldDeletedItems() {
  // This would be a server-side cron job or admin function
  // Not exposed via the API
}
```

---

## 🔐 Security Features

### User Isolation

```sql
-- Only deletes if user_id matches
UPDATE items
SET status = 'deleted'
WHERE id = $1 AND user_id = $2
```

**Result:** User cannot delete items they don't own

### Idempotency

Attempting to delete an already-deleted item returns 404:
- Prevents accidental double-deletion
- Clear error messaging
- No state changes

### Immutable Fields

During soft delete, only these fields change:
- `status` → 'deleted'
- `updated_at` → CURRENT_TIMESTAMP

All other fields remain unchanged:
- `id`, `user_id`, `text`, `category`, etc.

---

## 📊 Performance

### Database Performance

- Single UPDATE query
- Indexed on id (primary key)
- Filtered by user_id (indexed)
- Returns only id (minimal data)

### Query Performance

- Simple update: ~1-5ms
- No data fetching needed
- Efficient for bulk operations

---

## 🗄️ Database Maintenance

### Finding Deleted Items

```sql
-- Count deleted items per user
SELECT user_id, COUNT(*) as deleted_count
FROM items
WHERE status = 'deleted'
GROUP BY user_id;

-- Find old deleted items (if you have deleted_at timestamp)
SELECT id, text, updated_at
FROM items
WHERE status = 'deleted'
  AND updated_at < NOW() - INTERVAL '30 days';
```

### Hard Delete Implementation

If you need to implement hard delete later:

```typescript
// Service method
async hardDeleteItem(userId: string, itemId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM items
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [itemId, userId]
  );

  return result.rows.length > 0;
}
```

**⚠️ Warning:** Hard delete is permanent and cannot be undone!

---

## ✅ Task Completion Checklist

- [x] Create DELETE /api/items/:id endpoint
- [x] Validate ownership (item belongs to user)
- [x] Soft delete (set status='deleted')
- [x] Update updated_at timestamp
- [x] Return success message
- [x] Handle 404 for non-existent items
- [x] Handle 404 for items owned by other users
- [x] Handle 400 for invalid UUID
- [x] Handle 401 for auth errors
- [x] Item remains in database
- [x] Deleted items don't appear in default queries
- [x] Deleted items can be queried with status=deleted
- [x] Deleted items can be restored
- [x] Write comprehensive Jest tests (18 tests)
- [x] Create manual test script
- [x] Test: Delete item ✅
- [x] Test: Verify status='deleted' ✅
- [x] Documentation complete

---

## 🔜 Next Steps

Your backend API is now complete with all CRUD operations:
- ✅ CREATE (POST /api/items)
- ✅ READ (GET /api/items, GET /api/items/:id)
- ✅ UPDATE (PATCH /api/items/:id)
- ✅ DELETE (DELETE /api/items/:id)

**Potential enhancements:**
- Bulk delete endpoint
- Hard delete for admin users
- Automatic cleanup of old deleted items
- Trash/recycle bin UI
- Deleted items count in stats

---

## 🆘 Troubleshooting

### Issue: "Item not found" but I just created it

**Cause:** Item was already deleted

**Solution:** Check item status
```bash
curl -X GET "http://localhost:3000/api/items?status=deleted" \
  -H "Authorization: Bearer <token>"
```

### Issue: Cannot delete item twice

**This is expected behavior** - deleted items cannot be deleted again

To "delete" again:
1. Restore it first (PATCH status='active')
2. Then delete it again

### Issue: Want to permanently delete

**Current implementation:** Only soft delete is exposed via API

**Options:**
1. Use database directly (not recommended)
2. Implement hard delete endpoint (admin only)
3. Set up automated cleanup job

### Issue: Deleted items taking up space

**Solution:** Implement a cleanup policy:
- Archive deleted items older than X days
- Move to separate table
- Hard delete after retention period

---

## 📚 References

- [HTTP DELETE Method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE)
- [Soft Delete Pattern](https://en.wikipedia.org/wiki/Soft_deletion)
- [PostgreSQL UPDATE](https://www.postgresql.org/docs/current/sql-update.html)
- [Idempotent REST APIs](https://restfulapi.net/idempotent-rest-api/)
