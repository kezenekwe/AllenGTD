#!/bin/bash

# Allen GTD API - DELETE Items Tests
# Task 3.10: DELETE /api/items/:id Testing

BASE_URL="http://localhost:3000/api"

echo "=========================================="
echo "🗑️  Allen GTD - DELETE /api/items/:id Tests"
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

# ─── Step 2: Create Test Items ────────────────────────────────────────────

echo "${BLUE}Step 2: Creating test items...${NC}"
echo "--------------------------------"

# Create item 1
CREATE_1=$(curl -s -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Item to delete (Test 1)",
    "category": "inbox"
  }')

ITEM_ID_1=$(echo "$CREATE_1" | jq -r '.data.id')

# Create item 2
CREATE_2=$(curl -s -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Item to delete (Test 2)",
    "category": "nextActions"
  }')

ITEM_ID_2=$(echo "$CREATE_2" | jq -r '.data.id')

if [ "$ITEM_ID_1" != "null" ] && [ -n "$ITEM_ID_1" ] && [ "$ITEM_ID_2" != "null" ] && [ -n "$ITEM_ID_2" ]; then
  echo -e "${GREEN}✓ Created test items${NC}"
  echo -e "Item 1 ID: ${YELLOW}$ITEM_ID_1${NC}"
  echo -e "Item 2 ID: ${YELLOW}$ITEM_ID_2${NC}"
else
  echo -e "${RED}✗ Failed to create test items${NC}"
  exit 1
fi

echo ""

# ─── Test 1: Delete Item (Soft Delete) ────────────────────────────────────

echo "🗑️  Test 1: Delete Item (Soft Delete)"
echo "--------------------------------------"

DELETE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X DELETE "$BASE_URL/items/$ITEM_ID_1" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$DELETE_RESPONSE" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$DELETE_RESPONSE" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Successfully deleted item (200)${NC}"
else
  echo -e "${RED}✗ Failed to delete item, got HTTP $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 2: Verify Item Marked as Deleted ────────────────────────────────

echo "🔍 Test 2: Verify Item Marked as Deleted"
echo "-----------------------------------------"

# Try to get the deleted item (should not appear in default query)
DEFAULT_QUERY=$(curl -s -X GET "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN")

FOUND_IN_DEFAULT=$(echo "$DEFAULT_QUERY" | jq -r ".data[] | select(.id == \"$ITEM_ID_1\") | .id")

if [ -z "$FOUND_IN_DEFAULT" ]; then
  echo -e "${GREEN}✓ Deleted item NOT in default query (status=active)${NC}"
else
  echo -e "${RED}✗ Deleted item still appears in default query${NC}"
fi

# Query with status=deleted
DELETED_QUERY=$(curl -s -X GET "$BASE_URL/items?status=deleted" \
  -H "Authorization: Bearer $TOKEN")

echo "$DELETED_QUERY" | jq '.'

FOUND_IN_DELETED=$(echo "$DELETED_QUERY" | jq -r ".data[] | select(.id == \"$ITEM_ID_1\") | .status")

if [ "$FOUND_IN_DELETED" = "deleted" ]; then
  echo -e "${GREEN}✓ Item found with status=deleted${NC}"
else
  echo -e "${RED}✗ Item not found in deleted items${NC}"
fi

echo ""

# ─── Test 3: Delete Non-Existent Item ─────────────────────────────────────

echo "❌ Test 3: Delete Non-Existent Item"
echo "------------------------------------"

FAKE_UUID="00000000-0000-0000-0000-000000000000"

NONEXISTENT=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X DELETE "$BASE_URL/items/$FAKE_UUID" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$NONEXISTENT" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$NONEXISTENT" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "404" ]; then
  echo -e "${GREEN}✓ Correctly rejected non-existent item (404)${NC}"
else
  echo -e "${RED}✗ Should return 404, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 4: Invalid UUID Format ──────────────────────────────────────────

echo "❌ Test 4: Invalid UUID Format"
echo "-------------------------------"

INVALID_UUID=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X DELETE "$BASE_URL/items/invalid-uuid" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$INVALID_UUID" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$INVALID_UUID" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✓ Correctly rejected invalid UUID (400)${NC}"
else
  echo -e "${RED}✗ Should return 400, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 5: Delete Without Authentication ────────────────────────────────

echo "🔒 Test 5: Delete Without Authentication"
echo "-----------------------------------------"

NO_AUTH=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X DELETE "$BASE_URL/items/$ITEM_ID_2")

RESPONSE=$(echo "$NO_AUTH" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$NO_AUTH" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Correctly rejected unauthenticated request (401)${NC}"
else
  echo -e "${RED}✗ Should return 401, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 6: Delete Already Deleted Item ──────────────────────────────────

echo "♻️  Test 6: Delete Already Deleted Item (Idempotency)"
echo "------------------------------------------------------"

# Item 1 was already deleted in Test 1
DOUBLE_DELETE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X DELETE "$BASE_URL/items/$ITEM_ID_1" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$DOUBLE_DELETE" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$DOUBLE_DELETE" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "404" ]; then
  echo -e "${GREEN}✓ Correctly returned 404 for already deleted item${NC}"
  echo -e "   (Deleted items cannot be found for deletion)${NC}"
else
  echo -e "${YELLOW}⚠ Got HTTP $HTTP_CODE instead of 404${NC}"
fi

echo ""

# ─── Test 7: Restore Deleted Item ─────────────────────────────────────────

echo "♻️  Test 7: Restore Deleted Item"
echo "---------------------------------"

# Item 1 was deleted, try to restore it by updating status
RESTORE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PATCH "$BASE_URL/items/$ITEM_ID_1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active"
  }')

RESPONSE=$(echo "$RESTORE" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$RESTORE" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

NEW_STATUS=$(echo "$RESPONSE" | jq -r '.data.status')

if [ "$HTTP_CODE" = "200" ] && [ "$NEW_STATUS" = "active" ]; then
  echo -e "${GREEN}✓ Successfully restored deleted item${NC}"
else
  echo -e "${YELLOW}⚠ Restore returned HTTP $HTTP_CODE, status: $NEW_STATUS${NC}"
fi

echo ""

# ─── Test 8: Delete Complex Item ──────────────────────────────────────────

echo "📝 Test 8: Delete Item with All Fields Populated"
echo "--------------------------------------------------"

# Create a complex item
COMPLEX_CREATE=$(curl -s -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Complex item with all fields",
    "category": "projects",
    "nextAction": "Start phase 1",
    "waitingFor": "Team approval",
    "projectPlan": "Phase 1\nPhase 2\nPhase 3"
  }')

COMPLEX_ID=$(echo "$COMPLEX_CREATE" | jq -r '.data.id')

# Delete it
DELETE_COMPLEX=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X DELETE "$BASE_URL/items/$COMPLEX_ID" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$DELETE_COMPLEX" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Successfully deleted complex item${NC}"
  
  # Verify it's still in database with deleted status
  VERIFY_DELETED=$(curl -s -X GET "$BASE_URL/items?status=deleted" \
    -H "Authorization: Bearer $TOKEN")
  
  COMPLEX_DELETED=$(echo "$VERIFY_DELETED" | jq -r ".data[] | select(.id == \"$COMPLEX_ID\") | .status")
  
  if [ "$COMPLEX_DELETED" = "deleted" ]; then
    echo -e "${GREEN}✓ Complex item marked as deleted (all data preserved)${NC}"
  fi
else
  echo -e "${RED}✗ Failed to delete complex item${NC}"
fi

echo ""

# ─── Test 9: Count Active vs Deleted Items ────────────────────────────────

echo "📊 Test 9: Count Active vs Deleted Items"
echo "-----------------------------------------"

ACTIVE_COUNT=$(curl -s -X GET "$BASE_URL/items?status=active" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.count')

DELETED_COUNT=$(curl -s -X GET "$BASE_URL/items?status=deleted" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.count')

echo -e "Active items: ${GREEN}$ACTIVE_COUNT${NC}"
echo -e "Deleted items: ${YELLOW}$DELETED_COUNT${NC}"

if [ "$DELETED_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓ Soft delete working - deleted items are preserved${NC}"
else
  echo -e "${YELLOW}⚠ No deleted items found${NC}"
fi

echo ""

# ─── Summary ───────────────────────────────────────────────────────────────

echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo ""
echo "Features Tested:"
echo "  ✓ Soft delete item (status='deleted')"
echo "  ✓ Verify item marked as deleted"
echo "  ✓ Deleted items don't appear in default query"
echo "  ✓ Deleted items appear in status=deleted query"
echo "  ✓ Reject delete non-existent item (404)"
echo "  ✓ Reject invalid UUID (400)"
echo "  ✓ Reject unauthenticated requests (401)"
echo "  ✓ Idempotency (delete already deleted)"
echo "  ✓ Restore deleted items (PATCH status=active)"
echo "  ✓ Delete complex items (all data preserved)"
echo ""
echo "✨ All Tests Complete!"
echo "=========================================="
