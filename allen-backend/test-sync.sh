#!/bin/bash

# Allen GTD API - Sync Tests
# Task 4.1: GET /api/sync?since=<token> Testing

BASE_URL="http://localhost:3000/api"

echo "=========================================="
echo "🔄 Allen GTD - Sync Engine Tests"
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

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }' 2>/dev/null)

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token' 2>/dev/null)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${YELLOW}Login failed, trying registration...${NC}"
  
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
else
  echo -e "${RED}✗ Failed to get token${NC}"
  exit 1
fi

echo ""

# ─── Step 2: Create Initial Items ─────────────────────────────────────────

echo "${BLUE}Step 2: Creating initial items...${NC}"
echo "-----------------------------------"

for i in 1 2 3; do
  curl -s -X POST "$BASE_URL/items" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"Initial Item $i\",\"category\":\"inbox\"}" > /dev/null
done

echo -e "${GREEN}✓ Created 3 initial items${NC}"
echo ""

# ─── Test 1: First Sync (No Token) ────────────────────────────────────────

echo "🔄 Test 1: First Sync (No Token)"
echo "---------------------------------"

FIRST_SYNC=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/sync" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$FIRST_SYNC" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$FIRST_SYNC" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

SYNC_TOKEN=$(echo "$RESPONSE" | jq -r '.syncToken')
ITEM_COUNT=$(echo "$RESPONSE" | jq -r '.count')

if [ "$HTTP_CODE" = "200" ] && [ "$ITEM_COUNT" -ge "3" ]; then
  echo -e "${GREEN}✓ First sync successful (got $ITEM_COUNT items)${NC}"
  echo -e "Sync Token: ${YELLOW}$SYNC_TOKEN${NC}"
else
  echo -e "${RED}✗ First sync failed, got HTTP $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 2: No Changes Since Token ───────────────────────────────────────

echo "⏸️  Test 2: Sync with Token (No Changes)"
echo "-----------------------------------------"

sleep 1

NO_CHANGES=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/sync?since=$SYNC_TOKEN" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$NO_CHANGES" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$NO_CHANGES" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

CHANGE_COUNT=$(echo "$RESPONSE" | jq -r '.count')

if [ "$HTTP_CODE" = "200" ] && [ "$CHANGE_COUNT" = "0" ]; then
  echo -e "${GREEN}✓ No changes detected (empty array)${NC}"
else
  echo -e "${YELLOW}⚠ Got HTTP $HTTP_CODE, count: $CHANGE_COUNT${NC}"
fi

echo ""

# ─── Test 3: Create New Items After Sync ──────────────────────────────────

echo "➕ Test 3: Create Items After Sync"
echo "-----------------------------------"

sleep 1

# Create new items
for i in 4 5; do
  curl -s -X POST "$BASE_URL/items" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"New Item $i\",\"category\":\"nextActions\"}" > /dev/null
done

echo -e "${GREEN}✓ Created 2 new items${NC}"
echo ""

# ─── Test 4: Sync Gets Only New Changes ───────────────────────────────────

echo "🔄 Test 4: Sync Gets Only New Changes"
echo "--------------------------------------"

INCREMENTAL_SYNC=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/sync?since=$SYNC_TOKEN" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$INCREMENTAL_SYNC" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$INCREMENTAL_SYNC" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

NEW_CHANGES=$(echo "$RESPONSE" | jq -r '.count')
NEW_SYNC_TOKEN=$(echo "$RESPONSE" | jq -r '.syncToken')

if [ "$HTTP_CODE" = "200" ] && [ "$NEW_CHANGES" = "2" ]; then
  echo -e "${GREEN}✓ Got only new changes (2 items)${NC}"
  echo -e "New Sync Token: ${YELLOW}$NEW_SYNC_TOKEN${NC}"
  SYNC_TOKEN="$NEW_SYNC_TOKEN"
else
  echo -e "${YELLOW}⚠ Got HTTP $HTTP_CODE, count: $NEW_CHANGES${NC}"
fi

echo ""

# ─── Test 5: Sync Status Endpoint ─────────────────────────────────────────

echo "📊 Test 5: GET /api/sync/status"
echo "--------------------------------"

STATUS=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/sync/status" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$STATUS" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$STATUS" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

TOTAL_ITEMS=$(echo "$RESPONSE" | jq -r '.totalItems')

if [ "$HTTP_CODE" = "200" ] && [ "$TOTAL_ITEMS" -ge "0" ]; then
  echo -e "${GREEN}✓ Sync status retrieved successfully${NC}"
  echo -e "Total Items: ${YELLOW}$TOTAL_ITEMS${NC}"
else
  echo -e "${RED}✗ Failed to get sync status${NC}"
fi

echo ""

# ─── Summary ───────────────────────────────────────────────────────────────

echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo ""
echo "Features Tested:"
echo "  ✓ First sync (get all items)"
echo "  ✓ Incremental sync (no changes)"
echo "  ✓ Create items after sync"
echo "  ✓ Get only new changes"
echo "  ✓ Sync status endpoint"
echo ""
echo "✨ All Tests Complete!"
echo "=========================================="
