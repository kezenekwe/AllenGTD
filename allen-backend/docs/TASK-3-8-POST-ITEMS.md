# Task 3.8: POST /api/items

Complete implementation of item creation endpoint with validation and database persistence.

## 📋 Overview

**Endpoint:** `POST /api/items`

**Purpose:** Create new GTD items for the authenticated user

**Features:**
- ✅ Validate request body (text and category required)
- ✅ Insert into items table with auto-generated UUID
- ✅ Return created item with ID
- ✅ Link item to authenticated user
- ✅ Set default values for optional fields
- ✅ Support all GTD categories
- ✅ Protected route (requires authentication)

---

## 📡 API Endpoint

### POST /api/items

**Description:** Create a new item

**Authentication:** Required

**Request Body:**

```json
{
  "text": "string (required)",
  "category": "string (required)",
  "nextAction": "string (optional)",
  "waitingFor": "string (optional)",
  "projectPlan": "string (optional)"
}
```

**Category Values:**
- `inbox` - Unprocessed items
- `next` - Next actions to take
- `projects` - Multi-step outcomes
- `waiting` - Delegated/waiting items
- `someday` - Someday/maybe items
- `reference` - Reference materials

---

## 🎯 Request Examples

### Create Basic Inbox Item

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Buy groceries",
    "category": "inbox"
  }'
```

**Response (201):**
```json
{
  "message": "Item created successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "user-uuid",
    "text": "Buy groceries",
    "category": "inbox",
    "status": "active",
    "next_action": null,
    "waiting_for": null,
    "project_plan": null,
    "has_calendar": false,
    "created_at": "2025-01-15T10:00:00.000Z",
    "updated_at": "2025-01-15T10:00:00.000Z"
  }
}
```

---

### Create Next Action Item

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Review quarterly report",
    "category": "next",
    "nextAction": "Schedule review meeting"
  }'
```

**Response (201):**
```json
{
  "message": "Item created successfully",
  "data": {
    "id": "uuid",
    "text": "Review quarterly report",
    "category": "next",
    "next_action": "Schedule review meeting",
    ...
  }
}
```

---

### Create Waiting For Item

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Get approval from manager",
    "category": "waiting",
    "waitingFor": "Sarah from HR"
  }'
```

**Response (201):**
```json
{
  "message": "Item created successfully",
  "data": {
    "id": "uuid",
    "text": "Get approval from manager",
    "category": "waiting",
    "waiting_for": "Sarah from HR",
    ...
  }
}
```

---

### Create Project Item

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Build new website",
    "category": "projects",
    "projectPlan": "Step 1: Research\nStep 2: Design\nStep 3: Develop"
  }'
```

**Response (201):**
```json
{
  "message": "Item created successfully",
  "data": {
    "id": "uuid",
    "text": "Build new website",
    "category": "projects",
    "project_plan": "Step 1: Research\nStep 2: Design\nStep 3: Develop",
    ...
  }
}
```

---

## ❌ Error Responses

### 400 - Missing Required Field (text)

```json
{
  "error": "Validation Error",
  "message": "Text and category are required"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/items \
  -H "Authorization: Bearer <token>" \
  -d '{"category": "inbox"}'
```

---

### 400 - Missing Required Field (category)

```json
{
  "error": "Validation Error",
  "message": "Text and category are required"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/items \
  -H "Authorization: Bearer <token>" \
  -d '{"text": "Test item"}'
```

---

### 400 - Invalid Category

```json
{
  "error": "Validation Error",
  "message": "Invalid category. Must be one of: inbox, next, projects, waiting, someday, reference"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/items \
  -H "Authorization: Bearer <token>" \
  -d '{"text": "Test", "category": "invalid"}'
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
curl -X POST http://localhost:3000/api/items \
  -d '{"text": "Test", "category": "inbox"}'
```

---

### 500 - Server Error

```json
{
  "error": "Internal Server Error",
  "message": "Failed to create item"
}
```

---

## 🛢️ Database Operations

### SQL Query

```sql
INSERT INTO items (
  user_id,
  text,
  category,
  status,
  next_action,
  waiting_for,
  project_plan,
  has_calendar
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING 
  id,
  user_id,
  text,
  category,
  status,
  next_action,
  waiting_for,
  project_plan,
  has_calendar,
  created_at,
  updated_at;
```

### Default Values

- `status`: `'active'` (always)
- `next_action`: `null`
- `waiting_for`: `null`
- `project_plan`: `null`
- `has_calendar`: `false`
- `created_at`: `CURRENT_TIMESTAMP` (auto)
- `updated_at`: `CURRENT_TIMESTAMP` (auto)
- `id`: UUID (auto-generated)

---

## ✅ Validation Rules

### Required Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| text | string | Yes | Must not be empty |
| category | string | Yes | Must be valid category |

### Optional Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| nextAction | string | No | For 'next' category |
| waitingFor | string | No | For 'waiting' category |
| projectPlan | string | No | For 'projects' category |

### Category Validation

```typescript
const validCategories = [
  'inbox',
  'next',
  'projects',
  'waiting',
  'someday',
  'reference'
];

if (!validCategories.includes(category)) {
  return 400;
}
```

---

## 🧪 Testing

### Automated Tests (Jest)

Run the test suite:
```bash
cd allen-backend
npm test post-items.test.ts
```

**Test Coverage:**
- ✅ Authentication required
- ✅ Create basic inbox item
- ✅ Create next action with nextAction
- ✅ Create waiting item with waitingFor
- ✅ Create project with projectPlan
- ✅ All 6 categories work
- ✅ Missing text returns 400
- ✅ Missing category returns 400
- ✅ Invalid category returns 400
- ✅ Empty text returns 400
- ✅ Generate unique UUID
- ✅ Set default values
- ✅ Persist in database
- ✅ Set timestamps correctly
- ✅ Link to authenticated user
- ✅ Return 201 status
- ✅ Correct response structure
- ✅ Data isolation
- ✅ Handle special characters
- ✅ Handle unicode
- ✅ Handle long text (5000+ chars)
- ✅ Handle multiline text

### Manual Testing (Bash Script)

Make executable and run:
```bash
chmod +x test-post-items.sh
./test-post-items.sh
```

**Tests Included:**
1. Get auth token
2. Create basic inbox item ✅
3. Verify item in database ✅
4. Create next action item ✅
5. Create waiting item ✅
6. Create project item ✅
7. Missing text field ❌ (400)
8. Missing category field ❌ (400)
9. Invalid category ❌ (400)
10. No authentication ❌ (401)
11. All 6 categories ✅
12. Response format ✅

---

## 💻 Usage Examples

### JavaScript/TypeScript

```typescript
async function createItem(token: string, text: string, category: string) {
  const response = await fetch('http://localhost:3000/api/items', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, category }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const { data } = await response.json();
  return data;
}

// Usage
const item = await createItem(token, 'Buy groceries', 'inbox');
console.log('Created item:', item.id);
```

---

### React Native

```typescript
import { useState } from 'react';

function AddItemScreen() {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('inbox');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      
      const response = await fetch('http://localhost:3000/api/items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, category }),
      });

      if (!response.ok) {
        const error = await response.json();
        Alert.alert('Error', error.message);
        return;
      }

      const { data } = await response.json();
      Alert.alert('Success', 'Item created!');
      setText('');
    } catch (error) {
      Alert.alert('Error', 'Failed to create item');
    } finally {
      setLoading(false);
    }
  };

  // Render form...
}
```

---

## 🔒 Security Features

### User Isolation

- Items are always linked to authenticated user
- Cannot create items for other users
- user_id is taken from JWT token, not request body

**Example:**
```typescript
// This is secure - user_id from token
const userId = req.user.userId;

// NOT from request body (would be insecure)
// const userId = req.body.userId; ❌
```

### Input Validation

- Required fields validated
- Category values validated
- SQL injection prevented (parameterized queries)
- Text length unlimited but checked for empty string

---

## 📊 Performance

### Database Performance

- Single INSERT query
- Auto-generated UUID (database-level)
- Timestamps auto-set by database
- Returns inserted row immediately

### Optimization

```sql
-- Efficient with RETURNING clause
INSERT INTO items (...) VALUES (...)
RETURNING *;
-- No additional SELECT needed
```

---

## 🎯 Response Fields

### All Fields Returned

```typescript
interface CreatedItem {
  id: string;                    // Auto-generated UUID
  user_id: string;               // From auth token
  text: string;                  // From request
  category: string;              // From request
  status: 'active';              // Always 'active'
  next_action: string | null;    // From request or null
  waiting_for: string | null;    // From request or null
  project_plan: string | null;   // From request or null
  has_calendar: boolean;         // Always false
  created_at: Date;              // Auto-set
  updated_at: Date;              // Auto-set
}
```

---

## 💡 Best Practices

### Client-Side

1. **Validate before sending**
   ```typescript
   if (!text.trim()) {
     return; // Don't send empty text
   }
   ```

2. **Handle errors gracefully**
   ```typescript
   try {
     await createItem();
   } catch (error) {
     showErrorMessage(error.message);
   }
   ```

3. **Show loading state**
   ```typescript
   setLoading(true);
   await createItem();
   setLoading(false);
   ```

### Server-Side

1. **Always validate** - Never trust client input
2. **Use parameterized queries** - Prevent SQL injection
3. **Return created item** - Client needs the ID
4. **Set sensible defaults** - Reduce client complexity

---

## ✅ Task Completion Checklist

- [x] Create POST /api/items endpoint
- [x] Validate request body
- [x] Require text field
- [x] Require category field
- [x] Validate category values
- [x] Insert into items table
- [x] Auto-generate UUID
- [x] Link to authenticated user
- [x] Set default values
- [x] Set timestamps
- [x] Return created item with ID
- [x] Return 201 status code
- [x] Handle validation errors (400)
- [x] Handle auth errors (401)
- [x] Handle server errors (500)
- [x] Write Jest tests
- [x] Create manual test script
- [x] Test: Create item ✅
- [x] Test: Verify in DB ✅
- [x] Documentation complete

---

## 🔜 Next Steps

**Task 3.9:** PATCH /api/items/:id (Update items)
- Update existing items
- Validate updates
- Prevent updating other users' items

**Task 3.10:** DELETE /api/items/:id (Delete items)
- Soft delete (status='deleted')
- Hard delete option

---

## 🆘 Troubleshooting

### Issue: "Text and category are required"

Check request body:
```bash
# Wrong (missing category)
{"text": "Test"}

# Correct
{"text": "Test", "category": "inbox"}
```

### Issue: "Invalid category"

Valid categories:
- inbox
- next
- projects
- waiting
- someday
- reference

### Issue: Item not appearing in GET

Check status:
```bash
# Default GET only shows active items
GET /api/items

# Show all including completed/deleted
GET /api/items?status=completed
```

### Issue: UUID format error

UUIDs are auto-generated - don't include in request:
```bash
# Wrong
{"id": "some-id", "text": "Test", "category": "inbox"}

# Correct
{"text": "Test", "category": "inbox"}
```

---

## 📚 References

- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)
- [UUID Generation](https://www.postgresql.org/docs/current/functions-uuid.html)
- [REST API Design](https://restfulapi.net/http-methods/#post)
