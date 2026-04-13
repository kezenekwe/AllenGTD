#!/bin/bash

# Allen GTD API - POST Items Tests
# Task 3.8: POST /api/items Testing

BASE_URL="http://localhost:3000/api"

echo "=========================================="
echo "➕ Allen GTD - POST /api/items Tests"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── Step 1: Get Authentication Token ─────────────────────────────────────

echo "${BLUE}Step 1: Getting authentication token...${NC}"
echo "------------------------------------------"

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }' 2>/dev/null)

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token' 2>/dev/null)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${YELLOW}Login failed, trying registration...${NC}"

  REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Test User",
      "email": "test@example.com",
      "password": "TestPassword123"
    }' 2>/dev/null)

  TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token' 2>/dev/null)
fi

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✓ Got authentication token${NC}"
else
  echo -e "${RED}✗ Failed to get token${NC}"
  exit 1
fi

echo ""

# ─── Test 1: Create Basic Inbox Item ──────────────────────────────────────

echo "✅ Test 1: POST /api/items (Basic Inbox Item)"
echo "----------------------------------------------"

CREATE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Buy groceries",
    "category": "inbox"
  }')

RESPONSE=$(echo "$CREATE_RESPONSE" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$CREATE_RESPONSE" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

ITEM_ID=$(echo "$RESPONSE" | jq -r '.data.id')
ITEM_TEXT=$(echo "$RESPONSE" | jq -r '.data.text')
ITEM_CATEGORY=$(echo "$RESPONSE" | jq -r '.data.category')
ITEM_STATUS=$(echo "$RESPONSE" | jq -r '.data.status')

if [ "$HTTP_CODE" = "201" ] && [ "$ITEM_TEXT" = "Buy groceries" ] && [ "$ITEM_CATEGORY" = "inbox" ] && [ "$ITEM_STATUS" = "active" ]; then
  echo -e "${GREEN}✓ Successfully created item (201)${NC}"
  echo -e "Item ID: ${YELLOW}$ITEM_ID${NC}"
else
  echo -e "${RED}✗ Failed to create item, got HTTP $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 2: Verify Item in Database ──────────────────────────────────────

echo "🔍 Test 2: Verify Item Persisted in Database"
echo "---------------------------------------------"

if [ "$ITEM_ID" != "null" ] && [ -n "$ITEM_ID" ]; then
  DB_VERIFY=$(curl -s -X GET "$BASE_URL/items/$ITEM_ID" \
    -H "Authorization: Bearer $TOKEN")

  echo "$DB_VERIFY" | jq '.'

  DB_TEXT=$(echo "$DB_VERIFY" | jq -r '.data.text')

  if [ "$DB_TEXT" = "Buy groceries" ]; then
    echo -e "${GREEN}✓ Item found in database${NC}"
  else
    echo -e "${RED}✗ Item not found in database${NC}"
  fi
else
  echo -e "${YELLOW}⊘ Skipping - no item ID${NC}"
fi

echo ""

# ─── Test 3: Create Next Action with nextAction Field ─────────────────────

echo "➡️  Test 3: Create Next Action Item"
echo "------------------------------------"

NEXT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Review quarterly report",
    "category": "nextActions",
    "nextAction": "Schedule review meeting"
  }')

RESPONSE=$(echo "$NEXT_RESPONSE" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$NEXT_RESPONSE" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

NEXT_ACTION=$(echo "$RESPONSE" | jq -r '.data.next_action')

if [ "$HTTP_CODE" = "201" ] && [ "$NEXT_ACTION" = "Schedule review meeting" ]; then
  echo -e "${GREEN}✓ Next action item created with nextAction field${NC}"
else
  echo -e "${RED}✗ Failed, got HTTP $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 4: Create Waiting Item with waitingFor Field ────────────────────

echo "⏳ Test 4: Create Waiting For Item"
echo "-----------------------------------"

WAITING_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Get approval from manager",
    "category": "waiting",
    "waitingFor": "Sarah from HR"
  }')

RESPONSE=$(echo "$WAITING_RESPONSE" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$WAITING_RESPONSE" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

WAITING_FOR=$(echo "$RESPONSE" | jq -r '.data.waiting_for')

if [ "$HTTP_CODE" = "201" ] && [ "$WAITING_FOR" = "Sarah from HR" ]; then
  echo -e "${GREEN}✓ Waiting item created with waitingFor field${NC}"
else
  echo -e "${RED}✗ Failed, got HTTP $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 5: Create Project with projectPlan Field ────────────────────────

echo "📋 Test 5: Create Project Item"
echo "-------------------------------"

PROJECT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Build new website",
    "category": "projects",
    "projectPlan": "Step 1: Research\nStep 2: Design\nStep 3: Develop"
  }')

RESPONSE=$(echo "$PROJECT_RESPONSE" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$PROJECT_RESPONSE" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

PROJECT_PLAN=$(echo "$RESPONSE" | jq -r '.data.project_plan')

if [ "$HTTP_CODE" = "201" ] && [ "$PROJECT_PLAN" != "null" ]; then
  echo -e "${GREEN}✓ Project created with projectPlan field${NC}"
else
  echo -e "${RED}✗ Failed, got HTTP $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 6: Missing Required Fields ──────────────────────────────────────

echo "❌ Test 6: Missing Required Field (text)"
echo "-----------------------------------------"

MISSING_TEXT=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "inbox"
  }')

RESPONSE=$(echo "$MISSING_TEXT" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$MISSING_TEXT" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✓ Correctly rejected missing text field (400)${NC}"
else
  echo -e "${RED}✗ Should return 400, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 7: Missing Category Field ───────────────────────────────────────

echo "❌ Test 7: Missing Required Field (category)"
echo "---------------------------------------------"

MISSING_CATEGORY=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test item"
  }')

RESPONSE=$(echo "$MISSING_CATEGORY" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$MISSING_CATEGORY" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✓ Correctly rejected missing category field (400)${NC}"
else
  echo -e "${RED}✗ Should return 400, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 8: Invalid Category ─────────────────────────────────────────────

echo "❌ Test 8: Invalid Category"
echo "---------------------------"

INVALID_CATEGORY=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test item",
    "category": "invalid-category"
  }')

RESPONSE=$(echo "$INVALID_CATEGORY" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$INVALID_CATEGORY" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✓ Correctly rejected invalid category (400)${NC}"
else
  echo -e "${RED}✗ Should return 400, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 9: No Authentication ────────────────────────────────────────────

echo "🔒 Test 9: Create Item Without Authentication"
echo "----------------------------------------------"

NO_AUTH=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/items" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test item",
    "category": "inbox"
  }')

RESPONSE=$(echo "$NO_AUTH" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$NO_AUTH" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Correctly rejected unauthenticated request (401)${NC}"
else
  echo -e "${RED}✗ Should return 401, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 10: Create All Category Types ───────────────────────────────────

echo "📂 Test 10: Create Items in All Categories"
echo "-------------------------------------------"

CATEGORIES=("inbox" "nextActions" "projects" "waiting" "someday" "reference")
SUCCESS_COUNT=0

for category in "${CATEGORIES[@]}"; do
  RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/items" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"Test $category item\",\"category\":\"$category\"}")

  HTTP_CODE=$(echo "$RESPONSE" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

  if [ "$HTTP_CODE" = "201" ]; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo -e "${GREEN}✓ Created $category item${NC}"
  else
    echo -e "${RED}✗ Failed to create $category item (HTTP $HTTP_CODE)${NC}"
  fi
done

echo ""
if [ $SUCCESS_COUNT -eq 6 ]; then
  echo -e "${GREEN}✓ All 6 categories work correctly${NC}"
else
  echo -e "${YELLOW}⚠ Only $SUCCESS_COUNT/6 categories succeeded${NC}"
fi

echo ""

# ─── Test 11: Verify Response Format ──────────────────────────────────────

echo "📊 Test 11: Verify Response Format"
echo "-----------------------------------"

FORMAT_RESPONSE=$(curl -s -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Format test",
    "category": "inbox"
  }')

echo "$FORMAT_RESPONSE" | jq '{message, data: {id: .data.id, text: .data.text, category: .data.category, status: .data.status, created_at: .data.created_at}}'

HAS_MESSAGE=$(echo "$FORMAT_RESPONSE" | jq 'has("message")')
HAS_DATA=$(echo "$FORMAT_RESPONSE" | jq 'has("data")')
HAS_ID=$(echo "$FORMAT_RESPONSE" | jq '.data | has("id")')
HAS_USER_ID=$(echo "$FORMAT_RESPONSE" | jq '.data | has("user_id")')
HAS_TIMESTAMPS=$(echo "$FORMAT_RESPONSE" | jq '.data | has("created_at") and has("updated_at")')

if [ "$HAS_MESSAGE" = "true" ] && [ "$HAS_DATA" = "true" ] && [ "$HAS_ID" = "true" ] && [ "$HAS_USER_ID" = "true" ] && [ "$HAS_TIMESTAMPS" = "true" ]; then
  echo -e "${GREEN}✓ Response format is correct${NC}"
else
  echo -e "${RED}✗ Response format is incorrect${NC}"
fi

echo ""

# ─── Summary ───────────────────────────────────────────────────────────────

echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo ""
echo "Features Tested:"
echo "  ✓ Create basic inbox item"
echo "  ✓ Verify item persists in database"
echo "  ✓ Create next action with nextAction field"
echo "  ✓ Create waiting item with waitingFor field"
echo "  ✓ Create project with projectPlan field"
echo "  ✓ Reject missing text field (400)"
echo "  ✓ Reject missing category field (400)"
echo "  ✓ Reject invalid category (400)"
echo "  ✓ Reject unauthenticated requests (401)"
echo "  ✓ All 6 categories work"
echo "  ✓ Response format correct"
echo ""
echo "✨ All Tests Complete!"
echo "=========================================="
