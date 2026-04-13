#!/bin/bash

# Allen GTD API - Authentication Endpoint Tests
# Task 3.5: User Login Testing

BASE_URL="http://localhost:3000/api/v1/auth"

echo "=================================="
echo "🔐 Allen GTD - Auth API Tests"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ─── Test 1: Register New User ────────────────────────────────────────────

echo "📝 Test 1: Register New User"
echo "----------------------------------"

TEST_EMAIL="testuser_$(date +%s)@example.com"
TEST_PASSWORD="SecurePassword123"

REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"John Doe\",
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "$REGISTER_RESPONSE" | jq '.'

# Extract token for later use
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✓ Registration successful${NC}"
else
  echo -e "${RED}✗ Registration failed${NC}"
fi

echo ""

# ─── Test 2: Login with Correct Password ──────────────────────────────────

echo "✅ Test 2: Login with Correct Password"
echo "----------------------------------"

LOGIN_SUCCESS=$(curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "$LOGIN_SUCCESS" | jq '.'

LOGIN_TOKEN=$(echo "$LOGIN_SUCCESS" | jq -r '.token')

if [ "$LOGIN_TOKEN" != "null" ] && [ -n "$LOGIN_TOKEN" ]; then
  echo -e "${GREEN}✓ Login successful${NC}"
  echo -e "Token: ${YELLOW}$LOGIN_TOKEN${NC}"
else
  echo -e "${RED}✗ Login failed${NC}"
fi

echo ""

# ─── Test 3: Login with Incorrect Password ────────────────────────────────

echo "❌ Test 3: Login with Incorrect Password"
echo "----------------------------------"

LOGIN_FAIL=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"WrongPassword\"
  }")

RESPONSE=$(echo "$LOGIN_FAIL" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$LOGIN_FAIL" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Correctly rejected incorrect password (401)${NC}"
else
  echo -e "${RED}✗ Should return 401 for incorrect password, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 4: Login with Non-existent User ──────────────────────────────────

echo "❌ Test 4: Login with Non-existent Email"
echo "----------------------------------"

NONEXISTENT=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@example.com",
    "password": "SomePassword123"
  }')

RESPONSE=$(echo "$NONEXISTENT" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$NONEXISTENT" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Correctly rejected non-existent user (401)${NC}"
else
  echo -e "${RED}✗ Should return 401 for non-existent user, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 5: Get Current User (Protected Route) ────────────────────────────

echo "🔒 Test 5: Access Protected Route (/me)"
echo "----------------------------------"

if [ -n "$LOGIN_TOKEN" ] && [ "$LOGIN_TOKEN" != "null" ]; then
  ME_RESPONSE=$(curl -s -X GET "$BASE_URL/me" \
    -H "Authorization: Bearer $LOGIN_TOKEN")

  echo "$ME_RESPONSE" | jq '.'

  USER_EMAIL=$(echo "$ME_RESPONSE" | jq -r '.user.email')

  if [ "$USER_EMAIL" = "$TEST_EMAIL" ]; then
    echo -e "${GREEN}✓ Protected route works with valid token${NC}"
  else
    echo -e "${RED}✗ Protected route failed${NC}"
  fi
else
  echo -e "${YELLOW}⊘ Skipping - no valid token from previous tests${NC}"
fi

echo ""

# ─── Test 6: Access Protected Route Without Token ──────────────────────────

echo "❌ Test 6: Access Protected Route Without Token"
echo "----------------------------------"

NO_TOKEN=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$BASE_URL/me")

RESPONSE=$(echo "$NO_TOKEN" | sed 's/HTTP_CODE:.*//')
HTTP_CODE=$(echo "$NO_TOKEN" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)

echo "$RESPONSE" | jq '.'

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Correctly rejected request without token (401)${NC}"
else
  echo -e "${RED}✗ Should return 401 without token, got $HTTP_CODE${NC}"
fi

echo ""

# ─── Test 7: Validation Tests ──────────────────────────────────────────────

echo "🔍 Test 7: Validation Tests"
echo "----------------------------------"

echo "7a. Missing email field:"
MISSING_EMAIL=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "SomePassword123"
  }')

HTTP_CODE=$(echo "$MISSING_EMAIL" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)
if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✓ Correctly rejected missing email (400)${NC}"
else
  echo -e "${RED}✗ Should return 400, got $HTTP_CODE${NC}"
fi

echo ""

echo "7b. Missing password field:"
MISSING_PASSWORD=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }')

HTTP_CODE=$(echo "$MISSING_PASSWORD" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)
if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✓ Correctly rejected missing password (400)${NC}"
else
  echo -e "${RED}✗ Should return 400, got $HTTP_CODE${NC}"
fi

echo ""
echo "=================================="
echo "✨ Tests Complete!"
echo "=================================="
