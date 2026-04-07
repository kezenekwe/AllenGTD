# File Installation Guide - Task 3.5
## For `allen-backend` Repository

This guide shows you exactly where to copy each file in your **allen-backend** repository.

---

## 📁 Your Project Structure

You're working in the `allen-backend` directory (separate from the React Native app).

First, let's check/create the directory structure:

```bash
# You're already in allen-backend
pwd  # Should show: /path/to/allen-backend

# Create the directory structure if it doesn't exist
mkdir -p src/routes
mkdir -p src/services
mkdir -p src/middleware
mkdir -p src/db
mkdir -p src/__tests__
mkdir -p docs
```

---

## 📥 Files to Copy (Downloaded from Claude)

I provided 4 files for you to download. Here's where each one goes:

### File 1: Authentication Routes
**Downloaded as:** `auth.ts` (routes)
**Copy to:** `src/routes/auth.ts`

```bash
# From allen-backend directory:
cp ~/Downloads/auth.ts src/routes/auth.ts
```

### File 2: Authentication Tests
**Downloaded as:** `auth.test.ts`
**Copy to:** `src/__tests__/auth.test.ts`

```bash
cp ~/Downloads/auth.test.ts src/__tests__/auth.test.ts
```

### File 3: Manual Test Script
**Downloaded as:** `test-auth.sh`
**Copy to:** `test-auth.sh` (root of allen-backend)

```bash
cp ~/Downloads/test-auth.sh test-auth.sh
chmod +x test-auth.sh  # Make it executable
```

### File 4: Documentation
**Downloaded as:** `TASK-3-5-LOGIN.md`
**Copy to:** `docs/TASK-3-5-LOGIN.md`

```bash
mkdir -p docs
cp ~/Downloads/TASK-3-5-LOGIN.md docs/TASK-3-5-LOGIN.md
```

### File 5: Implementation Guide
**Downloaded as:** `IMPLEMENTATION-GUIDE.md`
**Copy to:** `docs/IMPLEMENTATION-GUIDE.md`

```bash
cp ~/Downloads/IMPLEMENTATION-GUIDE.md docs/IMPLEMENTATION-GUIDE.md
```

### File 6: This Installation Guide
**Downloaded as:** `FILE-INSTALLATION-GUIDE.md`
**Copy to:** `docs/FILE-INSTALLATION-GUIDE.md`

```bash
cp ~/Downloads/FILE-INSTALLATION-GUIDE.md docs/FILE-INSTALLATION-GUIDE.md
```

---

## 🚀 All Copy Commands in One Script

```bash
# Run this from the allen-backend directory:

# Create directories
mkdir -p src/routes
mkdir -p src/services
mkdir -p src/middleware
mkdir -p src/db
mkdir -p src/__tests__
mkdir -p docs

# Copy downloaded files
cp ~/Downloads/auth.ts src/routes/auth.ts
cp ~/Downloads/auth.test.ts src/__tests__/auth.test.ts
cp ~/Downloads/test-auth.sh test-auth.sh
cp ~/Downloads/TASK-3-5-LOGIN.md docs/TASK-3-5-LOGIN.md
cp ~/Downloads/IMPLEMENTATION-GUIDE.md docs/IMPLEMENTATION-GUIDE.md
cp ~/Downloads/FILE-INSTALLATION-GUIDE.md docs/FILE-INSTALLATION-GUIDE.md

# Make test script executable
chmod +x test-auth.sh

echo "✅ All downloaded files copied!"
```

---

## 📋 Files You May Need to Create

Depending on what's already in your `allen-backend` repo from Task 3.4, you may need to create these files:

### Check What You Already Have

```bash
# From allen-backend directory:
ls -la src/services/authService.ts     # Should exist from Task 3.4
ls -la src/middleware/auth.ts          # Should exist from Task 3.4
ls -la src/db/connection.ts            # Check if exists
ls -la src/app.ts                      # Check if exists
ls -la src/server.ts                   # Check if exists
ls -la .env                            # Check if exists
ls -la package.json                    # Should exist
ls -la tsconfig.json                   # Should exist
```

### If Files Are Missing

#### 1. Database Connection (if missing)
**Create:** `src/db/connection.ts`

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

#### 2. Express App (if missing)
**Create:** `src/app.ts`

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
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

export default app;
```

#### 3. Server Entry Point (if missing)
**Create:** `src/server.ts`

```typescript
import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/auth/login`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});
```

#### 4. Environment Variables (if missing)
**Create:** `.env`

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=allen_gtd
DB_USER=your_username
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your-super-secret-key-replace-this
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3000
NODE_ENV=development

# Bcrypt
BCRYPT_ROUNDS=10
```

**Generate a secure JWT secret:**
```bash
openssl rand -base64 64
```

Then paste it into your `.env` file.

#### 5. Update package.json (if needed)

Make sure you have these scripts:

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest"
  }
}
```

And these dependencies:
```bash
npm install express bcrypt jsonwebtoken pg cors dotenv
npm install --save-dev typescript ts-node-dev @types/express @types/bcrypt @types/jsonwebtoken @types/pg @types/cors @types/node
```

---

## 📂 Expected Final Structure

After copying files and creating missing ones:

```
allen-backend/
├── src/
│   ├── routes/
│   │   └── auth.ts              ← COPIED (File 1)
│   ├── services/
│   │   └── authService.ts       ← Should exist from Task 3.4
│   ├── middleware/
│   │   └── auth.ts              ← Should exist from Task 3.4
│   ├── db/
│   │   └── connection.ts        ← CREATE if missing
│   ├── __tests__/
│   │   └── auth.test.ts         ← COPIED (File 2)
│   ├── app.ts                   ← CREATE if missing
│   └── server.ts                ← CREATE if missing
├── docs/
│   ├── TASK-3-5-LOGIN.md        ← COPIED (File 4)
│   ├── IMPLEMENTATION-GUIDE.md  ← COPIED (File 5)
│   └── FILE-INSTALLATION-GUIDE.md ← COPIED (File 6)
├── test-auth.sh                 ← COPIED (File 3)
├── .env                         ← CREATE if missing
├── .gitignore                   ← Should have .env in it
├── package.json                 ← Should exist
├── tsconfig.json                ← Should exist
└── README.md                    ← Optional
```

---

## ✅ Verify Installation

Check that everything is in place:

```bash
# From allen-backend directory:

echo "=== Checking copied files ==="
ls -lh src/routes/auth.ts
ls -lh src/__tests__/auth.test.ts
ls -lh test-auth.sh
ls -lh docs/TASK-3-5-LOGIN.md

echo ""
echo "=== Checking existing files from Task 3.4 ==="
ls -lh src/services/authService.ts
ls -lh src/middleware/auth.ts

echo ""
echo "=== Checking files you may need to create ==="
ls -lh src/db/connection.ts
ls -lh src/app.ts
ls -lh src/server.ts
ls -lh .env

echo ""
echo "=== Checking config files ==="
ls -lh package.json
ls -lh tsconfig.json
```

If any file shows "No such file or directory", you need to create it.

---

## 🚀 Install Dependencies

```bash
# From allen-backend directory:

# Install production dependencies
npm install express bcrypt jsonwebtoken pg cors dotenv

# Install development dependencies
npm install --save-dev \
  typescript \
  ts-node-dev \
  @types/express \
  @types/bcrypt \
  @types/jsonwebtoken \
  @types/pg \
  @types/cors \
  @types/node \
  jest \
  supertest \
  @types/jest \
  @types/supertest \
  ts-jest
```

---

## 🏃 Run the Server

```bash
# Development mode with auto-reload
npm run dev

# You should see:
# 🚀 Server running on http://localhost:3000
# 📡 API endpoint: http://localhost:3000/api/auth/login
# 💚 Health check: http://localhost:3000/health
```

---

## 🧪 Test the Implementation

### Quick Test

```bash
# Health check
curl http://localhost:3000/health

# Should return:
# {"status":"ok","timestamp":"2025-01-15T..."}
```

### Run the Test Script

```bash
# From allen-backend directory:
./test-auth.sh

# This will run 7 tests and show you colored output
```

### Manual Login Test

```bash
# Test login (use a user from your database)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }'
```

---

## 🆘 Troubleshooting

### Issue: "Cannot find module './routes/auth'"

The file isn't in the right place. Check:
```bash
ls -la src/routes/auth.ts
```

Should exist. If not, copy it again:
```bash
cp ~/Downloads/auth.ts src/routes/auth.ts
```

### Issue: "Cannot find module '../services/authService'"

You need the authService from Task 3.4. If you don't have it, let me know and I'll provide it.

### Issue: "Database connection failed"

1. Check PostgreSQL is running:
   ```bash
   psql -U postgres -l
   ```

2. Verify your `.env` file has correct credentials

3. Test connection:
   ```bash
   psql -U your_username -d allen_gtd
   ```

### Issue: "Port 3000 already in use"

Change the port in `.env`:
```bash
PORT=3001
```

Or kill the process using port 3000:
```bash
lsof -ti:3000 | xargs kill -9
```

---

## 📝 Summary

**Files to copy from Downloads:**
1. ✅ `auth.ts` → `src/routes/auth.ts`
2. ✅ `auth.test.ts` → `src/__tests__/auth.test.ts`
3. ✅ `test-auth.sh` → `test-auth.sh`
4. ✅ `TASK-3-5-LOGIN.md` → `docs/TASK-3-5-LOGIN.md`

**Files that should already exist (from Task 3.4):**
- `src/services/authService.ts`
- `src/middleware/auth.ts`

**Files you might need to create:**
- `src/db/connection.ts`
- `src/app.ts`
- `src/server.ts`
- `.env`

**Then:**
1. Install dependencies
2. Run `npm run dev`
3. Test with `./test-auth.sh`

Let me know if you need any of the "should exist" or "might need to create" files! 🚀
