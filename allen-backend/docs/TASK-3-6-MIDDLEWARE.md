# Task 3.6: Auth Middleware

Complete implementation of JWT authentication middleware for protecting API routes.

## 📋 Overview

**Purpose:** Verify JWT tokens and protect routes from unauthorized access

**Features:**
- ✅ Extract JWT from Authorization header
- ✅ Verify Bearer token format
- ✅ Validate JWT signature and expiration
- ✅ Attach user info to request object
- ✅ Return 401 for invalid/missing tokens
- ✅ Optional authentication support
- ✅ Comprehensive error handling

---

## 🔧 Implementation

### Files Created

1. **src/middleware/auth.ts** - Authentication middleware
2. **src/routes/protected.ts** - Protected route examples
3. **src/__tests__/middleware.test.ts** - Jest test suite
4. **test-middleware.sh** - Manual testing script

---

## 🛡️ Middleware Functions

### 1. `authenticate` - Required Authentication

**Purpose:** Protect routes that require authentication

**Usage:**
```typescript
import { authenticate } from '../middleware/auth';

router.get('/protected', authenticate, (req, res) => {
  // req.user is guaranteed to exist
  res.json({ user: req.user });
});
```

**What it does:**
1. Extracts `Authorization` header
2. Validates `Bearer <token>` format
3. Verifies JWT signature
4. Checks token expiration
5. Attaches user to `req.user`
6. Returns 401 if any step fails

**Response on failure:**
```json
{
  "error": "Unauthorized",
  "message": "No authorization header provided"
}
```

---

### 2. `optionalAuth` - Optional Authentication

**Purpose:** Routes that work differently for authenticated users

**Usage:**
```typescript
import { optionalAuth } from '../middleware/auth';

router.get('/public', optionalAuth, (req, res) => {
  if (req.user) {
    // User is authenticated
    res.json({ message: 'Hello, user!', user: req.user });
  } else {
    // Anonymous user
    res.json({ message: 'Hello, guest!' });
  }
});
```

**What it does:**
1. Attempts to extract and verify token
2. If successful, attaches user to `req.user`
3. If fails, continues without user (no error)
4. Never returns 401

---

### 3. `requireRole` - Role-Based Access (Future)

**Purpose:** Check user roles (template for future use)

**Usage:**
```typescript
import { requireRole } from '../middleware/auth';

router.get('/admin', authenticate, requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin access granted' });
});
```

*Note: Currently a template - role checking not yet implemented*

---

## 📡 Request Flow

### Successful Authentication

```
Client Request
    ↓
Authorization: Bearer eyJhbGc...
    ↓
Middleware extracts token
    ↓
Verify JWT signature
    ↓
Check expiration
    ↓
Attach user to req.user
    ↓
Call next()
    ↓
Route Handler (req.user available)
    ↓
Response
```

### Failed Authentication

```
Client Request
    ↓
No Authorization header
    ↓
Middleware detects missing header
    ↓
Return 401 Unauthorized
    ↓
Stop (route handler never called)
```

---

## 🎯 Protected Routes Example

### GET /api/auth/me

**Description:** Get current user information

**Authentication:** Required

**Request:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <your-token>"
```

**Success Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2025-01-15T10:00:00.000Z",
    "is_active": true
  }
}
```

**Error Response (401):**
```json
{
  "error": "Unauthorized",
  "message": "No authorization header provided"
}
```

---

### GET /api/auth/test-protected

**Description:** Simple test route to verify authentication

**Authentication:** Required

**Request:**
```bash
curl -X GET http://localhost:3000/api/auth/test-protected \
  -H "Authorization: Bearer <your-token>"
```

**Success Response (200):**
```json
{
  "message": "Access granted! You are authenticated.",
  "user": {
    "userId": "uuid",
    "email": "user@example.com"
  },
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

---

### GET /api/auth/public

**Description:** Public route with optional authentication

**Authentication:** Optional

**Request (with token):**
```bash
curl -X GET http://localhost:3000/api/auth/public \
  -H "Authorization: Bearer <your-token>"
```

**Response (authenticated):**
```json
{
  "message": "Hello, user@example.com! You are authenticated.",
  "authenticated": true,
  "user": {
    "userId": "uuid",
    "email": "user@example.com"
  }
}
```

**Request (without token):**
```bash
curl -X GET http://localhost:3000/api/auth/public
```

**Response (anonymous):**
```json
{
  "message": "Hello, anonymous user!",
  "authenticated": false
}
```

---

## 🔒 Error Responses

### 401 - No Authorization Header

```json
{
  "error": "Unauthorized",
  "message": "No authorization header provided"
}
```

### 401 - Invalid Format

```json
{
  "error": "Unauthorized",
  "message": "Invalid authorization header format"
}
```

### 401 - Wrong Scheme

```json
{
  "error": "Unauthorized",
  "message": "Authorization scheme must be Bearer"
}
```

### 401 - Invalid Token

```json
{
  "error": "Unauthorized",
  "message": "Invalid token"
}
```

### 401 - Expired Token

```json
{
  "error": "Unauthorized",
  "message": "Token has expired"
}
```

---

## 🧪 Testing

### Automated Tests (Jest)

Run the test suite:
```bash
cd allen-backend
npm test middleware.test.ts
```

**Test Coverage:**
- ✅ Access protected route with valid token
- ✅ Reject request without authorization header
- ✅ Reject invalid token
- ✅ Reject malformed authorization header
- ✅ Reject non-Bearer scheme
- ✅ Reject empty token
- ✅ Reject expired token
- ✅ Optional auth with valid token
- ✅ Optional auth without token
- ✅ Extract userId and email from token
- ✅ Consistent error format

### Manual Testing (Bash Script)

Make executable and run:
```bash
chmod +x test-middleware.sh
./test-middleware.sh
```

**Tests Included:**
1. Get authentication token
2. Access protected route WITH token ✅
3. Access protected route WITHOUT token ❌
4. Access with invalid token ❌
5. Malformed authorization header ❌
6. Wrong authorization scheme ❌
7. Test protected route ✅
8. Public route with token ✅
9. Public route without token ✅
10. Verify user info attached to request ✅

---

## 💻 Integration Example

### Update app.ts

Add protected routes:

```typescript
import express from 'express';
import authRoutes from './routes/auth';
import protectedRoutes from './routes/protected';  // Add this

const app = express();

app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes (uses authenticate middleware)
app.use('/api/auth', protectedRoutes);  // Add this

export default app;
```

### Create Protected Endpoint

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/dashboard', authenticate, async (req, res) => {
  // req.user is guaranteed to exist
  const userId = req.user!.userId;
  
  // Fetch user-specific data
  const data = await getDashboardData(userId);
  
  res.json({ data });
});

export default router;
```

---

## 🔍 Request Object Extension

### TypeScript Declaration

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}
```

### Usage in Route Handlers

```typescript
router.get('/profile', authenticate, (req, res) => {
  // TypeScript knows req.user exists after authenticate middleware
  console.log(req.user.userId);   // string
  console.log(req.user.email);    // string
});
```

---

## 🛠️ How It Works

### Authorization Header Format

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
               ^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
               scheme token
```

**Valid formats:**
- ✅ `Bearer eyJhbG...`
- ❌ `bearer eyJhbG...` (case sensitive)
- ❌ `Basic eyJhbG...` (wrong scheme)
- ❌ `eyJhbG...` (missing scheme)

### Token Verification Process

```typescript
// 1. Extract token
const token = authHeader.split(' ')[1];

// 2. Verify signature and decode
const decoded = jwt.verify(token, JWT_SECRET);

// 3. Extract user info
const { userId, email } = decoded;

// 4. Attach to request
req.user = { userId, email };
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# .env
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
```

### Change Token Expiration

Update in `authService.ts`:
```typescript
const token = jwt.sign(payload, JWT_SECRET, {
  expiresIn: '24h'  // Change to 24 hours
});
```

---

## 🚨 Security Considerations

### Token Storage (Client-Side)

**Recommended:**
- Store in memory (most secure, lost on refresh)
- HttpOnly cookies (secure, requires CORS setup)

**Not Recommended:**
- LocalStorage (XSS vulnerable)
- SessionStorage (XSS vulnerable)

### HTTPS Required

**Production:** Always use HTTPS
- Prevents token interception
- Protects against man-in-the-middle attacks

### Token Expiration

**Default:** 7 days
- Balance between security and UX
- Shorter = more secure, less convenient
- Consider refresh tokens for longer sessions

---

## 📊 Performance

### Middleware Overhead

- JWT verification: ~1-2ms per request
- No database queries required
- Stateless authentication
- Scales horizontally

### Optimization Tips

1. **Cache decoded tokens** (advanced)
2. **Use shorter secrets** (not recommended for production)
3. **Implement token refresh** for longer sessions

---

## ✅ Task Completion Checklist

- [x] Create `authenticate` middleware
- [x] Extract JWT from Authorization header
- [x] Verify Bearer token format
- [x] Validate JWT signature
- [x] Check token expiration
- [x] Attach user to request object
- [x] Return 401 without token
- [x] Return 401 with invalid token
- [x] Return 401 with expired token
- [x] Create optional authentication
- [x] Create protected route examples
- [x] Write Jest tests
- [x] Create manual test script
- [x] Document all features
- [x] Test: Protected route returns 401 without token ✅

---

## 🔜 Next Steps

**Task 3.7:** Item CRUD endpoints (not started)
- Create, Read, Update, Delete items
- Link items to users
- Category filtering

---

## 🆘 Troubleshooting

### Issue: "Cannot find module '../services/authService'"

The middleware needs the `verifyToken` function from authService:

```typescript
// In authService.ts
export function verifyToken(token: string) {
  const decoded = jwt.verify(token, JWT_SECRET);
  return decoded as { userId: string; email: string };
}
```

### Issue: "req.user is undefined"

Check that:
1. Middleware is applied before route handler
2. Token is valid and not expired
3. Authorization header is correctly formatted

### Issue: TypeScript errors on req.user

Add the global declaration:
```typescript
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; email: string };
    }
  }
}
```

---

## 📚 References

- [JWT.io](https://jwt.io/) - Token debugger
- [Express Middleware](https://expressjs.com/en/guide/using-middleware.html)
- [jsonwebtoken npm](https://www.npmjs.com/package/jsonwebtoken)
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
