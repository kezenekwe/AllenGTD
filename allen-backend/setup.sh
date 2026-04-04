#!/bin/bash

# Allen GTD Backend Setup Script
# This script automates the setup process

set -e  # Exit on error

echo ""
echo "╔════════════════════════════════════════╗"
echo "║                                        ║"
echo "║   Allen GTD Backend Setup              ║"
echo "║                                        ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "✗ Node.js is not installed"
    echo "  Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

echo "✓ Node.js $(node --version) detected"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "✗ PostgreSQL is not installed"
    echo "  Please install PostgreSQL 14+ from https://postgresql.org"
    exit 1
fi

echo "✓ PostgreSQL detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✓ .env created from .env.example"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and set:"
    echo "   - DB_PASSWORD (your PostgreSQL password)"
    echo "   - JWT_SECRET (random secret key)"
    echo ""
else
    echo "✓ .env file already exists"
fi

# Test database connection
echo ""
echo "🔌 Testing database connection..."
if psql -U postgres -d allen_gtd -c "SELECT 1" &> /dev/null; then
    echo "✓ Database connection successful"
else
    echo "⚠️  Database 'allen_gtd' not found"
    echo ""
    read -p "Would you like to create it? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        createdb -U postgres allen_gtd
        echo "✓ Database 'allen_gtd' created"
    fi
fi

# Build TypeScript
echo ""
echo "🔨 Building TypeScript..."
npm run build

echo ""
echo "╔════════════════════════════════════════╗"
echo "║                                        ║"
echo "║   Setup Complete! ✓                    ║"
echo "║                                        ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Edit .env file with your configuration"
echo "  2. Start development server: npm run dev"
echo "  3. Test: curl http://localhost:3000/health"
echo ""
