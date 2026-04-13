# Task 3.9: PATCH /api/items/:id

Complete implementation of item update endpoint with ownership validation and field updates.

## 📋 Overview

**Endpoint:** `PATCH /api/items/:id`

**Purpose:** Update existing GTD items for the authenticated user

**Features:**
- ✅ Validate ownership (item belongs to user)
- ✅ Update fields (category, text, next_action, etc.)
- ✅ Return updated item
- ✅ Partial updates (only update specified fields)
- ✅ Automatic timestamp management
- ✅ Protected route (requires authentication)

---

## 📡 API Endpoint

### PATCH /api/items/:id

**Description:** Update an existing item

**Authentication:** Required

**Parameters:**
- `id` (path): Item UUID

**Request Body:** (all fields optional)

```json
{
  "text": "string (optional)",
  "category": "string (optional)",
  "status": "string (optional)",
  "nextAction": "string (optional)",
  "waitingFor": "string (optional)",
  "projectPlan": "string (optional)",
  "hasCalendar": "boolean (optional)"
}
```

---

## 🎯 Request Examples

### Update Category

```bash
curl -X PATCH http://localhost:3000/api/items/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "nextActions"
  }'
```

**Response (200):**
```json
{
  "message": "Item updated successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "user-uuid",
    "text": "Original text remains unchanged",
    "category": "nextActions",
    "status": "active",
    "next_action": null,
    "waiting_for": null,
    "project_plan": null,
    "has_calendar": false,
    "created_at": "2025-01-15T10:00:00.000Z",
    "updated_at": "2025-01-15T11:30:00.000Z"
  }
}
```

---

### Update Text

```bash
curl -X PATCH http://localhost:3000/api/items/<item-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Updated item description"
  }'
```

---

### Update Status to Completed

```bash
curl -X PATCH http://localhost:3000/api/items/<item-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed"
  }'
```

---

### Update Next Action

```bash
curl -X PATCH http://localhost:3000/api/items/<item-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nextAction": "Call John tomorrow at 2pm"
  }'
```

---

### Update Multiple Fields

```bash
curl -X PATCH http://localhost:3000/api/items/<item-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Updated description",
    "category": "projects",
    "nextAction": "Start planning phase",
    "projectPlan": "1. Research\n2. Design\n3. Build"
  }'
```

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
curl -X PATCH http://localhost:3000/api/items/invalid-id \
  -H "Authorization: Bearer <token>" \
  -d '{"text": "Test"}'
```

---

### 400 - Invalid Category

```json
{
  "error": "Validation Error",
  "message": "Invalid category. Must be one of: inbox, nextActions, projects, waiting, someday, reference"
}
```

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/items/<item-id> \
  -H "Authorization: Bearer <token>" \
  -d '{"category": "invalid"}'
```

---

### 400 - Invalid Status

```json
{
  "error": "Validation Error",
  "message": "Invalid status. Must be one of: active, completed, deleted"
}
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
curl -X PATCH http://localhost:3000/api/items/<item-id> \
  -d '{"text": "Test"}'
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

---

### 500 - Server Error

```json
{
  "error": "Internal Server Error",
  "message": "Failed to update item"
}
```

---

## 🔒 Ownership Validation

### How It Works

The `updateItem` service function includes `user_id` in the WHERE clause:

```sql
UPDATE items
SET text = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2 AND user_id = $3
RETURNING *;
```

**Security:**
- Users can only update their own items
- Attempting to update another user's item returns 404
- No information is leaked about items belonging to others

**Example:**
```typescript
// User A tries to update User B's item
PATCH /api/items/user-b-item-id
Authorization: Bearer user-a-token

// Response: 404 Not Found
// Item is not returned even though it exists
```

---

## 📝 Updatable Fields

### Required Fields
None - all fields are optional for PATCH

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| text | string | Item description |
| category | string | inbox, nextActions, projects, waiting, someday, reference |
| status | string | active, completed, deleted |
| nextAction | string \| null | Next action to take |
| waitingFor | string \| null | Who/what waiting for |
| projectPlan | string \| null | Project plan details |
| hasCalendar | boolean | Whether item has calendar event |

### Read-Only Fields

These fields cannot be updated:
- `id` - Item UUID (immutable)
- `user_id` - Owner (immutable)
- `created_at` - Creation timestamp (immutable)
- `updated_at` - Auto-updated on change

---

## 🛢️ Database Operations

### Dynamic UPDATE Query

The service builds queries dynamically based on provided fields:

```typescript
// Example: Update only category
UPDATE items
SET category = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2 AND user_id = $3
RETURNING *;

// Example: Update text and status
UPDATE items
SET text = $1, status = $2, updated_at = CURRENT_TIMESTAMP
WHERE id = $3 AND user_id = $4
RETURNING *;
```

### Timestamps

- `updated_at` is automatically set to `CURRENT_TIMESTAMP` on every update
- `created_at` remains unchanged

---

## 🧪 Testing

### Automated Tests (Jest)

Run the test suite:
```bash
cd allen-backend
npm test patch-items.test.ts
```

**Test Coverage:**
- ✅ Authentication (2 tests)
- ✅ Ownership validation (3 tests)
- ✅ Update category (6 tests - all categories)
- ✅ Update text (3 tests)
- ✅ Update status (3 tests)
- ✅ Update optional fields (5 tests)
- ✅ Update multiple fields (2 tests)
- ✅ Timestamps (2 tests)
- ✅ Response format (3 tests)
- ✅ Edge cases (4 tests)

**Total: 33 comprehensive tests**

### Manual Testing (Bash Script)

Make executable and run:
```bash
chmod +x test-patch-items.sh
./test-patch-items.sh
```

**Tests Included:**
1. Update item category ✅
2. Update item text ✅
3. Update next_action field ✅
4. Update status to completed ✅
5. Update multiple fields ✅
6. Invalid category ❌ (400)
7. Invalid UUID ❌ (400)
8. Non-existent item ❌ (404)
9. No authentication ❌ (401)
10. Verify final state ✅

---

## 💻 Usage Examples

### JavaScript/TypeScript

```typescript
async function updateItem(
  token: string,
  itemId: string,
  updates: Partial<{
    text: string;
    category: string;
    status: string;
    nextAction: string;
  }>
) {
  const response = await fetch(
    `http://localhost:3000/api/items/${itemId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const { data } = await response.json();
  return data;
}

// Usage
const updatedItem = await updateItem(token, itemId, {
  category: 'nextActions',
  nextAction: 'Call Sarah tomorrow',
});
```

---

### React Native

```typescript
import { useState } from 'react';

function EditItemScreen({ itemId }) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('inbox');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      
      const response = await fetch(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, category }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        Alert.alert('Error', error.message);
        return;
      }

      const { data } = await response.json();
      Alert.alert('Success', 'Item updated!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update item');
    } finally {
      setLoading(false);
    }
  };

  // Render form...
}
```

---

## 🎯 Common Use Cases

### Move Item to Different Category

```typescript
// Move from inbox to next actions
await updateItem(token, itemId, {
  category: 'nextActions',
  nextAction: 'First step to take',
});
```

### Complete an Item

```typescript
await updateItem(token, itemId, {
  status: 'completed',
});
```

### Add Next Action to Existing Item

```typescript
await updateItem(token, itemId, {
  nextAction: 'Follow up with client',
});
```

### Update Project Plan

```typescript
await updateItem(token, itemId, {
  projectPlan: 'Phase 1: Research\nPhase 2: Design\nPhase 3: Build',
});
```

### Clear Optional Field

```typescript
// Set to null to clear
await updateItem(token, itemId, {
  nextAction: null,
  waitingFor: null,
});
```

---

## 🔐 Security Features

### User Isolation

```sql
-- Only updates if user_id matches
UPDATE items
SET ...
WHERE id = $1 AND user_id = $2
```

**Result:** User cannot update items they don't own

### Immutable Fields

- `id` - Cannot be changed
- `user_id` - Cannot be changed (prevents taking ownership of items)
- `created_at` - Cannot be changed

### Input Validation

- Category values validated against whitelist
- Status values validated against whitelist
- UUID format validated
- SQL injection prevented (parameterized queries)

---

## 📊 Performance

### Database Performance

- Single UPDATE query
- Indexed on id (primary key)
- Filtered by user_id (indexed)
- Returns updated row immediately (no additional SELECT)

### Query Performance

- Simple update: ~1-5ms
- With validation: ~1-5ms
- Database automatically indexes primary key

---

## ✅ Task Completion Checklist

- [x] Create PATCH /api/items/:id endpoint
- [x] Validate ownership (item belongs to user)
- [x] Support updating category field
- [x] Support updating text field
- [x] Support updating status field
- [x] Support updating nextAction field
- [x] Support updating waitingFor field
- [x] Support updating projectPlan field
- [x] Support updating hasCalendar field
- [x] Partial updates (only specified fields)
- [x] Return updated item
- [x] Auto-update updated_at timestamp
- [x] Validate category values
- [x] Validate status values
- [x] Validate UUID format
- [x] Handle 404 for non-existent items
- [x] Handle 404 for items owned by other users
- [x] Handle 400 for validation errors
- [x] Handle 401 for auth errors
- [x] Write comprehensive Jest tests (33 tests)
- [x] Create manual test script
- [x] Test: Update item category ✅
- [x] Documentation complete

---

## 🔜 Next Steps

**Task 3.10:** DELETE /api/items/:id (Delete items)
- Soft delete (set status='deleted')
- Hard delete option
- Ownership validation

---

## 🆘 Troubleshooting

### Issue: "Item not found" but item exists

**Cause:** Item belongs to a different user

**Solution:** Verify you're using the correct authentication token

```bash
# Check item owner
SELECT user_id FROM items WHERE id = '<item-id>';

# Check current user
# Decode JWT token to see userId
```

### Issue: Updates not persisting

**Cause:** Transaction rolled back or database error

**Solution:** Check server logs for errors

```bash
# View server logs
npm run dev
# Look for "Update item error:" messages
```

### Issue: "Invalid category" error

**Cause:** Category name doesn't match expected values

**Valid categories:**
- `inbox`
- `nextActions` (not "next" or "next_actions")
- `projects`
- `waiting`
- `someday`
- `reference`

### Issue: Cannot update user_id

**This is by design** - user_id is immutable for security

Items cannot be transferred between users via API

---

## 📚 References

- [HTTP PATCH Method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH)
- [PostgreSQL UPDATE](https://www.postgresql.org/docs/current/sql-update.html)
- [REST API Best Practices](https://restfulapi.net/http-methods/#patch)
- [Partial Updates in REST](https://williamdurand.fr/2014/02/14/please-do-not-patch-like-an-idiot/)
