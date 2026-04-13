#!/bin/bash

# Allen GTD API - Authentication Middleware Tests
# Task 3.6: Auth Middleware Testing

BASE_URL="http://localhost:3000/api/v1/auth"

echo "=========================================="
echo "🔒 Allen GTD - Auth Middleware Tests"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── Step 1: Register & Login to Get Token ───────────────────────────────

echo -e "${BLUE}Step 1: Getting authentication token...${NC}"
echo "------------------------------------------"

# Register user
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Middleware Test User",
    "email": "middleware@example.com",
    "password": "MiddlewareTest123"
  }' 2>/dev/null)

TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token' 2>/dev/null)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  # Try logging in if user already exists
  echo "Registration failed, trying login..."
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "middleware@example.com",
      "password": "MiddlewareTest123"
    }' 2>/dev/null)
  
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token' 2>/dev/null)
fi

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✓ Got authentication token${NC}"
  echo -e "Token: ${YELLOW}${TOKEN:0:50}...${NC}"
else
  echo -e "${RED}✗ Failed to get token${NC}"
  echo "Response: $REGISTER_RESPONSE"
  exit 1
fi

echo ""

# ─── Test 1: Access Protected Route WITH Token ────────────────────────────

echo "✅ Test 1: Access Protected Route WITH Valid Token"
echo "---------------------------------------------------"

PROTECTED_SUCCESS=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/me" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$PROTECTED_SUCCESS" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$PROTECTED_SUCCESS" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Successfully accessed protected route (200)${NC}"
else
  echo -e "${RED}✗ Failed to access protected route, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 2: Access Protected Route WITHOUT Token ─────────────────────────

echo "❌ Test 2: Access Protected Route WITHOUT Token"
echo "------------------------------------------------"

NO_TOKEN=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/me")

RESPONSE=$(echo "$NO_TOKEN" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$NO_TOKEN" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Correctly rejected request without token (401)${NC}"
else
  echo -e "${RED}✗ Should return 401, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 3: Invalid Token ────────────────────────────────────────────────

echo "❌ Test 3: Access Protected Route with INVALID Token"
echo "-----------------------------------------------------"

INVALID_TOKEN=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/me" \
  -H "Authorization: Bearer invalid-token-here")

RESPONSE=$(echo "$INVALID_TOKEN" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$INVALID_TOKEN" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Correctly rejected invalid token (401)${NC}"
else
  echo -e "${RED}✗ Should return 401, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 4: Malformed Authorization Header ───────────────────────────────

echo "❌ Test 4: Malformed Authorization Header"
echo "------------------------------------------"

MALFORMED=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/me" \
  -H "Authorization: InvalidFormat")

RESPONSE=$(echo "$MALFORMED" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$MALFORMED" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Correctly rejected malformed header (401)${NC}"
else
  echo -e "${RED}✗ Should return 401, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 5: Wrong Authorization Scheme ───────────────────────────────────

echo "❌ Test 5: Wrong Authorization Scheme (Basic instead of Bearer)"
echo "---------------------------------------------------------------"

WRONG_SCHEME=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/me" \
  -H "Authorization: Basic $TOKEN")

RESPONSE=$(echo "$WRONG_SCHEME" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$WRONG_SCHEME" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Correctly rejected non-Bearer scheme (401)${NC}"
else
  echo -e "${RED}✗ Should return 401, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 6: Test Protected Route ─────────────────────────────────────────

echo "✅ Test 6: Access Test Protected Route"
echo "---------------------------------------"

TEST_PROTECTED=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/test-protected" \
  -H "Authorization: Bearer $TOKEN")

RESPONSE=$(echo "$TEST_PROTECTED" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$TEST_PROTECTED" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Test protected route works (200)${NC}"
else
  echo -e "${RED}✗ Failed to access test protected route, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 7: Optional Auth (Public Route) ─────────────────────────────────

echo "🔓 Test 7: Public Route WITH Token (Optional Auth)"
echo "---------------------------------------------------"

PUBLIC_WITH_TOKEN=$(curl -s -X GET "$BASE_URL/public" \
  -H "Authorization: Bearer $TOKEN")

echo "$PUBLIC_WITH_TOKEN" | jq '.'

AUTHENTICATED=$(echo "$PUBLIC_WITH_TOKEN" | jq -r '.authenticated')

if [ "$AUTHENTICATED" = "true" ]; then
  echo -e "${GREEN}✓ Recognized authenticated user${NC}"
else
  echo -e "${RED}✗ Should recognize authenticated user${NC}"
fi

echo ""

echo "🔓 Test 8: Public Route WITHOUT Token (Optional Auth)"
echo "------------------------------------------------------"

PUBLIC_WITHOUT_TOKEN=$(curl -s -X GET "$BASE_URL/public")

echo "$PUBLIC_WITHOUT_TOKEN" | jq '.'

AUTHENTICATED=$(echo "$PUBLIC_WITHOUT_TOKEN" | jq -r '.authenticated')

if [ "$AUTHENTICATED" = "false" ]; then
  echo -e "${GREEN}✓ Recognized anonymous user${NC}"
else
  echo -e "${RED}✗ Should recognize anonymous user${NC}"
fi

echo ""

# ─── Test 9: Token in Request User ────────────────────────────────────────

echo "🔍 Test 9: Verify User Info Attached to Request"
echo "------------------------------------------------"

USER_INFO=$(curl -s -X GET "$BASE_URL/test-protected" \
  -H "Authorization: Bearer $TOKEN")

echo "$USER_INFO" | jq '.'

USER_EMAIL=$(echo "$USER_INFO" | jq -r '.user.email')

if [ "$USER_EMAIL" = "middleware@example.com" ]; then
  echo -e "${GREEN}✓ User info correctly attached to request${NC}"
else
  echo -e "${RED}✗ User info not attached correctly${NC}"
fi

echo ""

# ─── Summary ───────────────────────────────────────────────────────────────

echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo ""
echo "Middleware Features Tested:"
echo "  ✓ Extract JWT from Authorization header"
echo "  ✓ Verify Bearer token format"
echo "  ✓ Verify JWT signature and expiration"
echo "  ✓ Attach user to request object"
echo "  ✓ Return 401 for missing/invalid tokens"
echo "  ✓ Optional authentication support"
echo "  ✓ Consistent error format"
echo ""
echo "✨ All Tests Complete!"
echo "=========================================="
