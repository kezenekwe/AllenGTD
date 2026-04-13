# Task 4.1: Sync Token System (Backend)

Complete implementation of sync engine with timestamp-based tokens for incremental synchronization.

## 📋 Overview

**Endpoints:** 
- `GET /api/sync?since=<token>`
- `POST /api/sync`
- `GET /api/sync/status`

**Purpose:** Enable efficient synchronization between mobile app and server

**Features:**
- ✅ Timestamp-based sync tokens
- ✅ Incremental sync (only changes since last sync)
- ✅ First sync (get all items)
- ✅ Multiple token formats (ISO timestamp, Unix milliseconds)
- ✅ Query items WHERE updated_at > token_timestamp
- ✅ Generate new sync token on each request
- ✅ Protected routes (requires authentication)

---

## 📡 Main Endpoint: GET /api/sync

**Query Parameters:**
- `since` (optional): Sync token from previous sync

**Token Formats:**
- ISO timestamp: `2025-01-15T10:00:00.000Z`
- Unix milliseconds: `1737024000000`

**Examples:**

```bash
# First sync
curl http://localhost:3000/api/sync \
  -H "Authorization: Bearer <token>"

# Incremental sync  
curl "http://localhost:3000/api/sync?since=2025-01-15T10:00:00.000Z" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "changes": [...items...],
  "syncToken": "2025-01-15T12:00:00.000Z",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "count": 5
}
```

---

## 🔄 How It Works

**First Sync:** Returns all items
**Incremental Sync:** Returns only items with `updated_at > since`

**SQL Query:**
```sql
SELECT * FROM items
WHERE user_id = $1 AND updated_at > $2
ORDER BY updated_at ASC
```

**Detects:**
- Created items
- Updated items  
- Deleted items (status='deleted')

---

## 💻 Client Integration

```typescript
// TypeScript example
const lastToken = await AsyncStorage.getItem('syncToken');
const url = lastToken ? `/sync?since=${lastToken}` : '/sync';

const response = await fetch(url, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { changes, syncToken } = await response.json();

// Apply changes
for (const item of changes) {
  await applyItemChange(item);
}

// Save new token
await AsyncStorage.setItem('syncToken', syncToken);
```

---

## 🧪 Testing

```bash
npm test sync.test.ts
./test-sync.sh
```

---

## ✅ Task Complete

All requirements met:
- [x] GET /api/sync?since=<token>
- [x] Query WHERE updated_at > token
- [x] Generate sync token
- [x] Return changes array with token
- [x] Test: Get changes since specific time

