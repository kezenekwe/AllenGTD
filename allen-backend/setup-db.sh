#!/bin/bash

# ============================================================================
# Allen GTD Database Setup Script
# ============================================================================

set -e  # Exit on error

echo ""
echo "╔════════════════════════════════════════╗"
echo "║                                        ║"
echo "║   Allen GTD Database Setup             ║"
echo "║                                        ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "✗ PostgreSQL is not installed"
    echo "  Install instructions:"
    echo "  • Mac: brew install postgresql@14"
    echo "  • Linux: sudo apt-get install postgresql"
    exit 1
fi

echo "✓ PostgreSQL $(psql --version | awk '{print $3}') detected"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✓ Environment variables loaded"
else
    echo "✗ .env file not found"
    echo "  Run: cp .env.example .env"
    exit 1
fi

# Database configuration
DB_NAME=${DB_NAME:-allen_gtd}
DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

echo ""
echo "Database Configuration:"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Check if database exists
if psql -U $DB_USER -h $DB_HOST -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "⚠️  Database '$DB_NAME' already exists"
    read -p "   Drop and recreate? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "   Dropping database..."
        dropdb -U $DB_USER -h $DB_HOST $DB_NAME
        echo "✓ Database dropped"
    else
        echo "   Keeping existing database"
        echo "   ⚠️  Migrations will still run"
    fi
fi

# Create database if it doesn't exist
if ! psql -U $DB_USER -h $DB_HOST -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "📦 Creating database '$DB_NAME'..."
    createdb -U $DB_USER -h $DB_HOST $DB_NAME
    echo "✓ Database created"
fi

# Run migrations
echo ""
echo "🔄 Running migrations..."
echo ""

MIGRATION_DIR="./migrations"

if [ ! -d "$MIGRATION_DIR" ]; then
    echo "✗ Migrations directory not found: $MIGRATION_DIR"
    exit 1
fi

# Run each migration file in order
for migration in $MIGRATION_DIR/*.sql; do
    if [ -f "$migration" ]; then
        filename=$(basename "$migration")
        echo "   Running: $filename"
        PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f "$migration" > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo "   ✓ $filename completed"
        else
            echo "   ✗ $filename failed"
            exit 1
        fi
    fi
done

# Test connection
echo ""
echo "🧪 Testing database connection..."
RESULT=$(PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -d $DB_NAME -t -c "SELECT 1" 2>/dev/null)

if [ "$RESULT" = " 1" ]; then
    echo "✓ Connection test successful"
else
    echo "✗ Connection test failed"
    exit 1
fi

# Show table counts
echo ""
echo "📊 Database Statistics:"
echo ""

TABLE_COUNTS=$(PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -d $DB_NAME -t -c "
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
")

echo "$TABLE_COUNTS" | while read -r table columns; do
    if [ -n "$table" ]; then
        echo "   • $table: $columns columns"
    fi
done

echo ""
echo "╔════════════════════════════════════════╗"
echo "║                                        ║"
echo "║   Database Setup Complete! ✓           ║"
echo "║                                        ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Start the server: npm run dev"
echo "  2. Test the connection in your app"
echo ""
