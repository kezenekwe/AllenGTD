# Task 3.5: User Login - Implementation Guide

Step-by-step guide to implement the user login endpoint in your Allen GTD backend.

---

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ Node.js backend project initialized
- ✅ PostgreSQL database running
- ✅ Users table created (from Task 3.4)
- ✅ Dependencies installed: express, bcrypt, jsonwebtoken, pg

---

## 🚀 Step-by-Step Implementation

### Step 1: Install Dependencies

```bash
cd backend

# Core dependencies
npm install express bcrypt jsonwebtoken pg

# TypeScript types
npm install --save-dev @types/express @types/bcrypt @types/jsonwebtoken @types/pg

# Testing dependencies (optional)
npm install --save-dev jest supertest @types/jest @types/supertest ts-jest
```

---

### Step 2: Set Up Environment Variables

Create or update `.env` file:

```bash
# backend/.env

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/allen_gtd
DB_HOST=localhost
DB_PORT=5432
DB_NAME=allen_gtd
DB_USER=your_username
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Bcrypt
BCRYPT_ROUNDS=10

# Server
PORT=3000
NODE_ENV=development
```

**Important:** Generate a secure JWT secret:
```bash
openssl rand -base64 64
```

---

### Step 3: Create Database Connection

**File:** `backend/src/db/connection.ts`

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'allen_gtd',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
}

export default pool;
```

---

### Step 4: Create Authentication Service

**File:** `backend/src/services/authService.ts`

Copy the file I provided earlier, or create it with these key methods:

```typescript
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export class AuthService {
  async login(data: { email: string; password: string }) {
    // 1. Find user by email
    const result = await query(
      `SELECT id, email, password_hash, name, created_at, is_active
       FROM users
       WHERE email = $1`,
      [data.email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = result.rows[0];

    // 2. Check if active
    if (!user.is_active) {
      throw new Error('Account is disabled');
    }

    // 3. Verify password
    const isValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // 4. Update last login
    await query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // 5. Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        is_active: user.is_active,
      },
    };
  }
}

export const authService = new AuthService();
```

---

### Step 5: Create Authentication Routes

**File:** `backend/src/routes/auth.ts`

```typescript
import { Router } from 'express';
import { authService } from '../services/authService';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email and password are required',
      });
    }

    // Login
    const result = await authService.login({ email, password });

    return res.status(200).json({
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    console.error('Login error:', error);

    if (error instanceof Error) {
      if (
        error.message.includes('Invalid email or password') ||
        error.message.includes('disabled')
      ) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: error.message,
        });
      }
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed',
    });
  }
});

export default router;
```

---

### Step 6: Create Main App File

**File:** `backend/src/app.ts`

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
```

---

### Step 7: Create Server Entry Point

**File:** `backend/src/server.ts`

```typescript
import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/auth/login`);
});
```

---

### Step 8: Update package.json

**File:** `backend/package.json`

```json
{
  "name": "allen-gtd-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.11.3",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/pg": "^8.10.9",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.10.6",
    "typescript": "^5.3.3",
    "ts-node-dev": "^2.0.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "@types/jest": "^29.5.11",
    "@types/supertest": "^6.0.2",
    "ts-jest": "^29.1.1"
  }
}
```

---

### Step 9: Create TypeScript Config

**File:** `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

### Step 10: Set Up Database (if not done)

Run these SQL commands:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create a test user (password: TestPassword123)
INSERT INTO users (email, password_hash, name)
VALUES (
  'test@example.com',
  '$2b$10$rOKlW8qJ9LhXKZYZ9pZVHOwvB3eOXQ7x5hEQJYHXJx8Y3VZfGX7jm',
  'Test User'
);
```

---

## 🏃 Running the Server

### Development Mode

```bash
cd backend
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:3000
📡 API endpoint: http://localhost:3000/api/auth/login
```

### Production Mode

```bash
npm run build
npm start
```

---

## 🧪 Testing the Implementation

### Test 1: Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Test 2: Login with Correct Credentials

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }'
```

Expected response (200):
```json
{
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-here",
      "email": "test@example.com",
      "name": "Test User",
      "created_at": "2025-01-15T10:00:00.000Z",
      "is_active": true
    }
  }
}
```

### Test 3: Login with Wrong Password

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "WrongPassword"
  }'
```

Expected response (401):
```json
{
  "error": "Unauthorized",
  "message": "Invalid email or password"
}
```

### Test 4: Missing Fields

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

Expected response (400):
```json
{
  "error": "Validation Error",
  "message": "Email and password are required"
}
```

---

## 📂 Final Project Structure

```
backend/
├── src/
│   ├── db/
│   │   └── connection.ts          # Database connection
│   ├── services/
│   │   └── authService.ts         # Authentication logic
│   ├── routes/
│   │   └── auth.ts                # Auth endpoints
│   ├── middleware/
│   │   └── auth.ts                # JWT middleware (future)
│   ├── app.ts                     # Express app setup
│   └── server.ts                  # Server entry point
├── .env                           # Environment variables
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
└── README.md                      # Documentation
```

---

## 🐛 Troubleshooting

### Issue: "Cannot find module 'dotenv'"
```bash
npm install dotenv
```

### Issue: "Database connection failed"
1. Check PostgreSQL is running:
   ```bash
   psql -U postgres -l
   ```
2. Verify `.env` credentials
3. Test connection:
   ```bash
   psql -U your_username -d allen_gtd
   ```

### Issue: "JWT_SECRET not defined"
Add to `.env`:
```bash
JWT_SECRET=$(openssl rand -base64 64)
```

### Issue: Port already in use
Change port in `.env`:
```bash
PORT=3001
```

### Issue: TypeScript errors
```bash
npm install --save-dev @types/node
```

---

## ✅ Verification Checklist

After implementation, verify:

- [ ] Server starts without errors
- [ ] Health endpoint responds
- [ ] Login with correct password returns token
- [ ] Login with wrong password returns 401
- [ ] Login with missing fields returns 400
- [ ] JWT token can be decoded at jwt.io
- [ ] Token includes userId and email
- [ ] last_login_at updates in database
- [ ] Password hash is never returned to client

---

## 🎯 Next Steps

Once login works:

1. **Add registration endpoint** (if not already done)
2. **Create authentication middleware** for protected routes
3. **Implement token refresh** (optional)
4. **Add password reset** (optional)
5. **Move to Task 3.6** - Sync endpoints

---

## 📚 Additional Resources

- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [JWT.io Debugger](https://jwt.io/)
- [bcrypt.js Docs](https://github.com/kelektiv/node.bcrypt.js)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 💡 Tips

1. **Start simple** - Get basic login working first
2. **Use Postman** - Easier than curl for testing
3. **Check logs** - `console.log` is your friend
4. **Test incrementally** - Test each step as you build
5. **Use git** - Commit after each working step

Good luck! 🚀
