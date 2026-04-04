-- ============================================================================
-- Allen GTD Database Schema
-- Migration: 001_initial_schema
-- Description: Creates users, items, project_steps, and sync_log tables
-- ============================================================================

-- ─── Enable UUID Extension ─────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users Table ───────────────────────────────────────────────────────────

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Index for faster email lookups (login)
CREATE INDEX idx_users_email ON users(email);

-- ─── Items Table ───────────────────────────────────────────────────────────

CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Core GTD fields
    text TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('inbox', 'nextActions', 'projects', 'waiting', 'someday', 'reference')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'deleted')),
    
    -- Category-specific fields
    next_action TEXT,
    waiting_for VARCHAR(255),
    project_plan TEXT,
    has_calendar BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Sync fields
    client_id VARCHAR(255), -- WatermelonDB ID from mobile
    synced_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1
);

-- Indexes for faster queries
CREATE INDEX idx_items_user_id ON items(user_id);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_user_category ON items(user_id, category);
CREATE INDEX idx_items_client_id ON items(client_id);
CREATE INDEX idx_items_updated_at ON items(updated_at);

-- ─── Project Steps Table ───────────────────────────────────────────────────

CREATE TABLE project_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    step_text TEXT NOT NULL,
    step_order INTEGER NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Sync fields
    client_id VARCHAR(255),
    synced_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1
);

-- Indexes
CREATE INDEX idx_project_steps_project_id ON project_steps(project_id);
CREATE INDEX idx_project_steps_user_id ON project_steps(user_id);
CREATE INDEX idx_project_steps_order ON project_steps(project_id, step_order);
CREATE INDEX idx_project_steps_client_id ON project_steps(client_id);

-- ─── Sync Log Table ────────────────────────────────────────────────────────

CREATE TABLE sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Sync metadata
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    
    -- Data snapshot
    data JSONB,
    
    -- Timestamps
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for sync queries
CREATE INDEX idx_sync_log_user_id ON sync_log(user_id);
CREATE INDEX idx_sync_log_synced_at ON sync_log(synced_at);
CREATE INDEX idx_sync_log_user_synced ON sync_log(user_id, synced_at);

-- ─── Triggers ──────────────────────────────────────────────────────────────

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to items table
CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to project_steps table
CREATE TRIGGER update_project_steps_updated_at
    BEFORE UPDATE ON project_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ─── Sample Data (Optional - for testing) ─────────────────────────────────

-- Uncomment to create a test user (password: "password123")
-- INSERT INTO users (email, password_hash, name) VALUES
-- ('test@example.com', '$2b$10$rBV2kYlZ5YxK0Y.9ZqJ7uO0RYwN5vF5X6QjH8GqW0Yp9gLhNxB2Xm', 'Test User');

-- ============================================================================
-- End of Migration
-- ============================================================================
