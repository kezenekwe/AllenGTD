#!/bin/bash

# Allen GTD API - Items Endpoint Tests
# Task 3.7: GET /api/items Testing

BASE_URL="http://localhost:3000/api"

echo "=========================================="
echo "📦 Allen GTD - Items API Tests"
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

# Try to login
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }' 2>/dev/null)

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token' 2>/dev/null)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${YELLOW}Login failed, trying registration...${NC}"
  
  # Try registering
  REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Test User",
      "email": "test@example.com",
      "password": "TestPassword123"
    }' 2>/dev/null)
  
  TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.token' 2>/dev/null)
fi

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✓ Got authentication token${NC}"
  echo -e "Token: ${YELLOW}${TOKEN:0:50}...${NC}"
else
  echo -e "${RED}✗ Failed to get token${NC}"
  exit 1
fi

echo ""

# ─── Step 2: Create Test Items ────────────────────────────────────────────

echo "${BLUE}Step 2: Creating test items...${NC}"
echo "-------------------------------"

# Create inbox items
for i in 1 2 3; do
  curl -s -X POST "$BASE_URL/items" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"Inbox Item $i\",\"category\":\"inbox\"}" > /dev/null
done

# Create next action
curl -s -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Next Action Item","category":"next"}' > /dev/null

# Create project
curl -s -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Project Item","category":"projects","projectPlan":"Step 1\nStep 2"}' > /dev/null

# Create waiting for
curl -s -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Waiting Item","category":"waiting","waitingFor":"John"}' > /dev/null

echo -e "${GREEN}✓ Created test items${NC}"
echo ""

# ─── Test 1: Get All Items ────────────────────────────────────────────────

echo "✅ Test 1: GET /api/items (All Items)"
echo "--------------------------------------"

ALL_ITEMS=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$ALL_ITEMS" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$ALL_ITEMS" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

COUNT=$(echo "$RESPONSE" | jq -r '.count')

if [ "$HTTP_CODE" = "200" ] && [ "$COUNT" -ge "6" ]; then
  echo -e "${GREEN}✓ Successfully got all items (200, count: $COUNT)${NC}"
else
  echo -e "${RED}✗ Failed to get items, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 2: Filter by Category (Inbox) ───────────────────────────────────

echo "📥 Test 2: GET /api/items?category=inbox"
echo "------------------------------------------"

INBOX_ITEMS=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/items?category=inbox" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$INBOX_ITEMS" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$INBOX_ITEMS" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

COUNT=$(echo "$RESPONSE" | jq -r '.count')
CATEGORY=$(echo "$RESPONSE" | jq -r '.filters.category')

if [ "$HTTP_CODE" = "200" ] && [ "$CATEGORY" = "inbox" ] && [ "$COUNT" = "3" ]; then
  echo -e "${GREEN}✓ Successfully filtered inbox items (200, count: $COUNT)${NC}"
else
  echo -e "${RED}✗ Unexpected result: HTTP $HTTP_CODE, count: $COUNT${NC}"
fi

echo ""

# ─── Test 3: Filter by Category (Next) ────────────────────────────────────

echo "➡️  Test 3: GET /api/items?category=next"
echo "-----------------------------------------"

NEXT_ITEMS=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/items?category=next" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$NEXT_ITEMS" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$NEXT_ITEMS" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

COUNT=$(echo "$RESPONSE" | jq -r '.count')

if [ "$HTTP_CODE" = "200" ] && [ "$COUNT" -ge "1" ]; then
  echo -e "${GREEN}✓ Successfully filtered next action items (200, count: $COUNT)${NC}"
else
  echo -e "${RED}✗ Failed, got HTTP $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 4: Filter by Category (Projects) ────────────────────────────────

echo "📋 Test 4: GET /api/items?category=projects"
echo "--------------------------------------------"

PROJECT_ITEMS=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/items?category=projects" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$PROJECT_ITEMS" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$PROJECT_ITEMS" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

COUNT=$(echo "$RESPONSE" | jq -r '.count')

if [ "$HTTP_CODE" = "200" ] && [ "$COUNT" -ge "1" ]; then
  echo -e "${GREEN}✓ Successfully filtered project items (200, count: $COUNT)${NC}"
else
  echo -e "${RED}✗ Failed, got HTTP $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 5: Invalid Category ─────────────────────────────────────────────

echo "❌ Test 5: GET /api/items?category=invalid"
echo "-------------------------------------------"

INVALID=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/items?category=invalid" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$INVALID" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$INVALID" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✓ Correctly rejected invalid category (400)${NC}"
else
  echo -e "${RED}✗ Should return 400, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 6: No Authentication ────────────────────────────────────────────

echo "🔒 Test 6: GET /api/items (Without Auth Token)"
echo "-----------------------------------------------"

NO_AUTH=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/items")

RESPONSE=$(echo "$NO_AUTH" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$NO_AUTH" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Correctly rejected request without auth (401)${NC}"
else
  echo -e "${RED}✗ Should return 401, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 7: Get Single Item ──────────────────────────────────────────────

echo "🔍 Test 7: GET /api/items/:id (Single Item)"
echo "--------------------------------------------"

# Get first item ID from all items
FIRST_ITEM_ID=$(curl -s -X GET "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

if [ "$FIRST_ITEM_ID" != "null" ] && [ -n "$FIRST_ITEM_ID" ]; then
  SINGLE_ITEM=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/items/$FIRST_ITEM_ID" \
    -H "Authorization: Bearer $TOKEN")

  RESPONSE=$(echo "$SINGLE_ITEM" | sed 's/HTTP_CODE:.*//')
  HTTP_CODE=$(echo "$SINGLE_ITEM" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

  echo "$RESPONSE" | jq '.'

  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Successfully got single item (200)${NC}"
  else
    echo -e "${RED}✗ Failed, got HTTP $HTTP_CODE${NC}"
  fi
else
  echo -e "${YELLOW}⊘ Skipping - no items to test${NC}"
fi

echo ""

# ─── Test 8: Response Format ──────────────────────────────────────────────

echo "📊 Test 8: Verify Response Format"
echo "----------------------------------"

RESPONSE=$(curl -s -X GET "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN")

echo "$RESPONSE" | jq '{data: .data[:2], count, filters}'

HAS_DATA=$(echo "$RESPONSE" | jq 'has("data")')
HAS_COUNT=$(echo "$RESPONSE" | jq 'has("count")')
HAS_FILTERS=$(echo "$RESPONSE" | jq 'has("filters")')

if [ "$HAS_DATA" = "true" ] && [ "$HAS_COUNT" = "true" ] && [ "$HAS_FILTERS" = "true" ]; then
  echo -e "${GREEN}✓ Response has correct format (data, count, filters)${NC}"
else
  echo -e "${RED}✗ Response missing required fields${NC}"
fi

echo ""

# ─── Test 9: User Isolation ───────────────────────────────────────────────

echo "🔐 Test 9: Verify User Isolation"
echo "---------------------------------"

# Check that all returned items belong to authenticated user
ALL_ITEMS_JSON=$(curl -s -X GET "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN")

USER_IDS=$(echo "$ALL_ITEMS_JSON" | jq -r '.data[].user_id' | sort -u)
UNIQUE_COUNT=$(echo "$USER_IDS" | wc -l)

if [ "$UNIQUE_COUNT" = "1" ]; then
  echo -e "${GREEN}✓ All items belong to authenticated user${NC}"
  echo "User ID: $(echo "$USER_IDS" | head -1)"
else
  echo -e "${RED}✗ Found items from multiple users${NC}"
fi

echo ""

# ─── Summary ───────────────────────────────────────────────────────────────

echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo ""
echo "Features Tested:"
echo "  ✓ Get all items (user-scoped)"
echo "  ✓ Filter by category (inbox, next, projects)"
echo "  ✓ Invalid category returns 400"
echo "  ✓ No auth returns 401"
echo "  ✓ Get single item by ID"
echo "  ✓ Response format (data, count, filters)"
echo "  ✓ User data isolation"
echo ""
echo "✨ All Tests Complete!"
echo "=========================================="
