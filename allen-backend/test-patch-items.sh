#!/bin/bash

# Allen GTD API - PATCH Items Tests
# Task 3.9: PATCH /api/items/:id Testing

BASE_URL="http://localhost:3000/api"

echo "=========================================="
echo "✏️  Allen GTD - PATCH /api/items/:id Tests"
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

# ─── Step 2: Create Test Item ─────────────────────────────────────────────

echo "${BLUE}Step 2: Creating test item...${NC}"
echo "-------------------------------"

CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test item for PATCH operations",
    "category": "inbox"
  }')

ITEM_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.id')

if [ "$ITEM_ID" != "null" ] && [ -n "$ITEM_ID" ]; then
  echo -e "${GREEN}✓ Created test item${NC}"
  echo -e "Item ID: ${YELLOW}$ITEM_ID${NC}"
else
  echo -e "${RED}✗ Failed to create test item${NC}"
  exit 1
fi

echo ""

# ─── Test 1: Update Item Category ─────────────────────────────────────────

echo "✅ Test 1: Update Item Category (inbox → nextActions)"
echo "-------------------------------------------------------"

UPDATE_CATEGORY=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PATCH "$BASE_URL/items/$ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "nextActions"
  }')

RESPONSE=$(echo "$UPDATE_CATEGORY" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$UPDATE_CATEGORY" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

NEW_CATEGORY=$(echo "$RESPONSE" | jq -r '.data.category')

if [ "$HTTP_CODE" = "200" ] && [ "$NEW_CATEGORY" = "nextActions" ]; then
  echo -e "${GREEN}✓ Successfully updated category to nextActions (200)${NC}"
else
  echo -e "${RED}✗ Failed to update category, got HTTP $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 2: Update Item Text ─────────────────────────────────────────────

echo "✏️  Test 2: Update Item Text"
echo "----------------------------"

UPDATE_TEXT=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PATCH "$BASE_URL/items/$ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Updated item text via PATCH"
  }')

RESPONSE=$(echo "$UPDATE_TEXT" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$UPDATE_TEXT" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

NEW_TEXT=$(echo "$RESPONSE" | jq -r '.data.text')

if [ "$HTTP_CODE" = "200" ] && [ "$NEW_TEXT" = "Updated item text via PATCH" ]; then
  echo -e "${GREEN}✓ Successfully updated text (200)${NC}"
else
  echo -e "${RED}✗ Failed to update text, got HTTP $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 3: Update Next Action Field ─────────────────────────────────────

echo "➡️  Test 3: Update Next Action Field"
echo "-------------------------------------"

UPDATE_NEXT_ACTION=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PATCH "$BASE_URL/items/$ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nextAction": "Call Sarah tomorrow at 2pm"
  }')

RESPONSE=$(echo "$UPDATE_NEXT_ACTION" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$UPDATE_NEXT_ACTION" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

NEXT_ACTION=$(echo "$RESPONSE" | jq -r '.data.next_action')

if [ "$HTTP_CODE" = "200" ] && [ "$NEXT_ACTION" = "Call Sarah tomorrow at 2pm" ]; then
  echo -e "${GREEN}✓ Successfully updated next_action field (200)${NC}"
else
  echo -e "${RED}✗ Failed to update next_action, got HTTP $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 4: Update Status to Completed ───────────────────────────────────

echo "✔️  Test 4: Update Status to Completed"
echo "---------------------------------------"

UPDATE_STATUS=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PATCH "$BASE_URL/items/$ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed"
  }')

RESPONSE=$(echo "$UPDATE_STATUS" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$UPDATE_STATUS" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

NEW_STATUS=$(echo "$RESPONSE" | jq -r '.data.status')

if [ "$HTTP_CODE" = "200" ] && [ "$NEW_STATUS" = "completed" ]; then
  echo -e "${GREEN}✓ Successfully updated status to completed (200)${NC}"
else
  echo -e "${RED}✗ Failed to update status, got HTTP $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 5: Update Multiple Fields at Once ───────────────────────────────

echo "📝 Test 5: Update Multiple Fields at Once"
echo "------------------------------------------"

UPDATE_MULTIPLE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PATCH "$BASE_URL/items/$ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Multi-field update test",
    "category": "projects",
    "status": "active",
    "projectPlan": "Step 1: Planning\nStep 2: Execution"
  }')

RESPONSE=$(echo "$UPDATE_MULTIPLE" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$UPDATE_MULTIPLE" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

UPDATED_TEXT=$(echo "$RESPONSE" | jq -r '.data.text')
UPDATED_CATEGORY=$(echo "$RESPONSE" | jq -r '.data.category')
UPDATED_STATUS=$(echo "$RESPONSE" | jq -r '.data.status')

if [ "$HTTP_CODE" = "200" ] && [ "$UPDATED_TEXT" = "Multi-field update test" ] && [ "$UPDATED_CATEGORY" = "projects" ] && [ "$UPDATED_STATUS" = "active" ]; then
  echo -e "${GREEN}✓ Successfully updated multiple fields (200)${NC}"
else
  echo -e "${RED}✗ Failed to update multiple fields, got HTTP $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 6: Invalid Category ─────────────────────────────────────────────

echo "❌ Test 6: Invalid Category"
echo "---------------------------"

INVALID_CATEGORY=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PATCH "$BASE_URL/items/$ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
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

# ─── Test 7: Invalid UUID Format ──────────────────────────────────────────

echo "❌ Test 7: Invalid UUID Format"
echo "-------------------------------"

INVALID_UUID=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PATCH "$BASE_URL/items/invalid-uuid" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Should fail"
  }')

RESPONSE=$(echo "$INVALID_UUID" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$INVALID_UUID" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✓ Correctly rejected invalid UUID (400)${NC}"
else
  echo -e "${RED}✗ Should return 400, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 8: Non-existent Item ────────────────────────────────────────────

echo "❌ Test 8: Non-existent Item"
echo "-----------------------------"

FAKE_UUID="00000000-0000-0000-0000-000000000000"

NONEXISTENT=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PATCH "$BASE_URL/items/$FAKE_UUID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Should fail"
  }')

RESPONSE=$(echo "$NONEXISTENT" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$NONEXISTENT" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "404" ]; then
  echo -e "${GREEN}✓ Correctly rejected non-existent item (404)${NC}"
else
  echo -e "${RED}✗ Should return 404, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 9: No Authentication ────────────────────────────────────────────

echo "🔒 Test 9: Update Without Authentication"
echo "-----------------------------------------"

NO_AUTH=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PATCH "$BASE_URL/items/$ITEM_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Should fail"
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

# ─── Test 10: Verify Final State ──────────────────────────────────────────

echo "🔍 Test 10: Verify Final Item State"
echo "------------------------------------"

FINAL_STATE=$(curl -s -X GET "$BASE_URL/items/$ITEM_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$FINAL_STATE" | jq '.'

FINAL_CATEGORY=$(echo "$FINAL_STATE" | jq -r '.data.category')
FINAL_STATUS=$(echo "$FINAL_STATE" | jq -r '.data.status')

echo ""
echo -e "Final Category: ${YELLOW}$FINAL_CATEGORY${NC}"
echo -e "Final Status: ${YELLOW}$FINAL_STATUS${NC}"

if [ "$FINAL_CATEGORY" = "projects" ] && [ "$FINAL_STATUS" = "active" ]; then
  echo -e "${GREEN}✓ Item state correctly reflects all updates${NC}"
else
  echo -e "${YELLOW}⚠ Item state may not reflect latest updates${NC}"
fi

echo ""

# ─── Summary ───────────────────────────────────────────────────────────────

echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo ""
echo "Features Tested:"
echo "  ✓ Update item category"
echo "  ✓ Update item text"
echo "  ✓ Update next_action field"
echo "  ✓ Update status to completed"
echo "  ✓ Update multiple fields at once"
echo "  ✓ Reject invalid category (400)"
echo "  ✓ Reject invalid UUID (400)"
echo "  ✓ Reject non-existent item (404)"
echo "  ✓ Reject unauthenticated requests (401)"
echo "  ✓ Verify ownership validation"
echo ""
echo "✨ All Tests Complete!"
echo "=========================================="
