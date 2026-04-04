# Allen GTD Backend API

Backend API for the Allen GTD mobile application.

## Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ installed and running
- npm or yarn package manager

## Project Structure

```
allen-backend/
├── src/
│   ├── index.ts           # Server entry point
│   ├── db/
│   │   └── index.ts       # Database connection
│   ├── routes/
│   │   ├── auth.ts        # Authentication routes
│   │   └── items.ts       # Item CRUD routes
│   └── services/
│       └── itemService.ts # Business logic
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## Installation

### Step 1: Install Dependencies

```bash
cd allen-backend
npm install
```

### Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
# Update DB_PASSWORD and JWT_SECRET
```

### Step 3: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE allen_gtd;

# Exit psql
\q
```

### Step 4: Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests (not yet implemented)

## Testing the Server

### 1. Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-03-29T12:00:00.000Z",
  "uptime": 12.345,
  "environment": "development"
}
```

### 2. API Info

```bash
curl http://localhost:3000
```

Expected response:
```json
{
  "name": "Allen GTD API",
  "version": "1.0.0",
  "description": "Backend API for Allen GTD mobile app",
  "endpoints": {
    "health": "/health",
    "api": "/api/v1"
  }
}
```

### 3. API v1 Routes

```bash
curl http://localhost:3000/api/v1
```

Expected response:
```json
{
  "message": "Allen GTD API v1",
  "status": "ready",
  "routes": {
    "auth": "/api/v1/auth",
    "items": "/api/v1/items",
    "sync": "/api/v1/sync"
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment (development/production) | development |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | allen_gtd |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | - |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | JWT expiration time | 7d |
| `CORS_ORIGIN` | Allowed CORS origin | * |

## Development Workflow

1. Make changes to TypeScript files in `src/`
2. Server auto-reloads via `ts-node-dev`
3. Test endpoints with curl or Postman
4. Check console for logs

## Next Steps (Week 3 Tasks)

- **Task 3.2**: Database Schema & Migrations
- **Task 3.3**: User Authentication Endpoints
- **Task 3.4**: Item CRUD Endpoints
- **Task 3.5**: Sync Endpoint

## Troubleshooting

### Server won't start

1. Check if port 3000 is already in use:
   ```bash
   lsof -i :3000
   ```

2. Check if PostgreSQL is running:
   ```bash
   pg_isready
   ```

### Database connection fails

1. Verify PostgreSQL is running
2. Check credentials in `.env`
3. Ensure database exists: `psql -U postgres -c "\l"`

### TypeScript errors

1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Check `tsconfig.json` is present

## License

ISC
