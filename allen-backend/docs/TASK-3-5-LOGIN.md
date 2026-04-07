# Task 3.5: User Login

Complete implementation of user authentication with password verification and JWT token generation.

## 📋 Overview

**Endpoint:** `POST /api/auth/login`

**Purpose:** Authenticate users and generate JWT access tokens

**Features:**
- ✅ Email/password validation
- ✅ Bcrypt password verification
- ✅ JWT token generation (7-day expiry)
- ✅ Last login timestamp tracking
- ✅ Account status checking
- ✅ Comprehensive error handling

---

## 🔧 Implementation

### Files Created

1. **src/routes/auth.ts** - Authentication routes
2. **src/__tests__/auth.test.ts** - Jest test suite
3. **test-auth.sh** - Manual testing script

### Files from Previous Tasks

- **src/services/authService.ts** - Authentication service (from Task 3.4)
- **src/middleware/auth.ts** - JWT authentication middleware (from Task 3.4)

---

## 📡 API Endpoint

### POST /api/auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Success Response (200):**
```json
{
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "created_at": "2025-01-15T10:30:00.000Z",
      "is_active": true
    }
  }
}
```

**Error Responses:**

```json
// 400 - Missing fields
{
  "error": "Validation Error",
  "message": "Email and password are required"
}

// 401 - Invalid credentials
{
  "error": "Unauthorized",
  "message": "Invalid email or password"
}

// 401 - Disabled account
{
  "error": "Unauthorized",
  "message": "Account is disabled"
}

// 500 - Server error
{
  "error": "Internal Server Error",
  "message": "Login failed"
}
```

---

## 🔐 Security Features

### Password Verification
- Uses bcrypt's `compare()` function
- Secure constant-time comparison
- Prevents timing attacks

### JWT Token
- **Algorithm:** HS256 (HMAC SHA-256)
- **Expiry:** 7 days (configurable via `JWT_EXPIRES_IN`)
- **Payload:**
  ```json
  {
    "userId": "user-uuid",
    "email": "user@example.com",
    "iat": 1642248000,
    "exp": 1642852800
  }
  ```

### Error Messages
- Generic "Invalid email or password" for both wrong email and wrong password
- Prevents user enumeration attacks
- Detailed errors only logged server-side

---

## 🧪 Testing

### Automated Tests (Jest)

Run the test suite:
```bash
cd backend
npm test auth.test.ts
```

**Test Coverage:**
- ✅ Login with correct credentials
- ✅ Login with incorrect password
- ✅ Login with non-existent email
- ✅ Login with missing email
- ✅ Login with missing password
- ✅ Token validation and structure
- ✅ Protected route access

### Manual Testing (curl)

Make the script executable and run:
```bash
cd backend
chmod +x test-auth.sh
./test-auth.sh
```

**Tests Included:**
1. Register new user
2. Login with correct password ✅
3. Login with incorrect password ❌
4. Login with non-existent user ❌
5. Access protected route with token ✅
6. Access protected route without token ❌
7. Validation tests (missing fields) ❌

---

## 📊 Database Operations

### Login Flow

1. **Find User**
   ```sql
   SELECT id, email, password_hash, name, created_at, is_active
   FROM users
   WHERE email = $1
   ```

2. **Verify Password**
   ```typescript
   await bcrypt.compare(password, passwordHash)
   ```

3. **Update Last Login**
   ```sql
   UPDATE users 
   SET last_login_at = CURRENT_TIMESTAMP 
   WHERE id = $1
   ```

4. **Generate JWT**
   ```typescript
   jwt.sign({ userId, email }, SECRET, { expiresIn: '7d' })
   ```

---

## 🎯 Usage Example

### JavaScript/TypeScript

```typescript
// Login request
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123',
  }),
});

const data = await response.json();

if (response.ok) {
  // Store token
  localStorage.setItem('token', data.data.token);
  console.log('Logged in as:', data.data.user.name);
} else {
  console.error('Login failed:', data.message);
}
```

### curl

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'
```

### Using Token for Protected Routes

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# .env file
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10
```

**Important:** Change `JWT_SECRET` in production to a strong random string:
```bash
openssl rand -base64 64
```

---

## 🔍 Validation Rules

### Email
- Must be valid email format
- Case-insensitive (stored as lowercase)
- Required field

### Password
- Required field
- Must match stored bcrypt hash
- Minimum 8 characters (enforced during registration)

---

## 🚨 Error Handling

### Client Errors (4xx)

| Code | Scenario | Message |
|------|----------|---------|
| 400 | Missing email or password | "Email and password are required" |
| 401 | Wrong credentials | "Invalid email or password" |
| 401 | Disabled account | "Account is disabled" |

### Server Errors (5xx)

| Code | Scenario | Action |
|------|----------|--------|
| 500 | Database error | Logged, generic message returned |
| 500 | Bcrypt error | Logged, generic message returned |
| 500 | JWT error | Logged, generic message returned |

---

## 📈 Performance

### Bcrypt Performance
- ~200-300ms per hash verification (by design)
- Prevents brute-force attacks
- Uses 10 salt rounds (configurable)

### Database Queries
- Single SELECT query
- Single UPDATE query
- Indexed on email field

---

## ✅ Task Completion Checklist

- [x] POST /api/auth/login endpoint created
- [x] Password verification with bcrypt
- [x] JWT token generation
- [x] Token includes userId and email
- [x] 7-day expiration configured
- [x] User info returned (no password hash)
- [x] Last login timestamp updated
- [x] Account status check
- [x] Error handling for all cases
- [x] Jest tests written
- [x] Manual test script created
- [x] Test: Login with correct password ✅
- [x] Test: Login with incorrect password ✅
- [x] Documentation complete

---

## 🔜 Next Steps

**Task 3.6:** Sync endpoint (not started)
- GET/POST endpoints for syncing items
- Conflict resolution
- Last sync timestamp

---

## 📝 Notes

### Security Considerations
- Passwords are never logged
- Generic error messages prevent enumeration
- bcrypt automatically handles salts
- JWT tokens expire after 7 days
- HTTPS required in production

### Testing Tips
- Use separate test database
- Clean up test users in teardown
- Test both success and failure cases
- Verify token structure and payload
- Check HTTP status codes

---

## 🆘 Troubleshooting

**Issue:** "Invalid token" error
- **Solution:** Check JWT_SECRET matches between server instances

**Issue:** Login always fails
- **Solution:** Verify password was hashed during registration

**Issue:** Token expired immediately
- **Solution:** Check JWT_EXPIRES_IN environment variable

**Issue:** Database connection error
- **Solution:** Verify PostgreSQL is running and credentials are correct

---

## 📚 References

- [JWT.io](https://jwt.io/) - JWT debugger and documentation
- [bcrypt.js](https://github.com/kelektiv/node.bcrypt.js) - Password hashing
- [Express.js](https://expressjs.com/) - Web framework
- [Jest](https://jestjs.io/) - Testing framework
- [Supertest](https://github.com/visionmedia/supertest) - HTTP assertion library
