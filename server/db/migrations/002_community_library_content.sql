-- ============================================================================
-- NEXORA Platform - Phase 5 / P1.2 Database Foundation Schema
-- Migration: 002_community_library_content.sql
-- Description: DDL for the 10 core domain tables:
--   1. community_posts
--   2. community_attachments
--   3. community_comments
--   4. community_likes
--   5. community_bookmarks
--   6. library_resources
--   7. content_items
--   8. event_details
--   9. event_registrations
--  10. contact_inquiries
-- Target: PostgreSQL 14+ (Supabase / Isolated PostgreSQL)
-- ============================================================================

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. COMMUNITY_POSTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_posts (
    id VARCHAR(50) PRIMARY KEY,
    author_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    grade_level VARCHAR(50) NOT NULL,
    summary TEXT NOT NULL,
    content TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'review', 'published', 'hidden', 'archived')),
    likes_count INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
    comments_count INTEGER NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
    bookmarks_count INTEGER NOT NULL DEFAULT 0 CHECK (bookmarks_count >= 0),
    views_count INTEGER NOT NULL DEFAULT 0 CHECK (views_count >= 0),
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_posts_author_id ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_status ON community_posts(status);
CREATE INDEX IF NOT EXISTS idx_community_posts_subject ON community_posts(subject);
CREATE INDEX IF NOT EXISTS idx_community_posts_grade_level ON community_posts(grade_level);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_pinned ON community_posts(is_pinned DESC, created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. COMMUNITY_ATTACHMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_attachments (
    id VARCHAR(50) PRIMARY KEY,
    post_id VARCHAR(50) NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    mime_type VARCHAR(100) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_attachments_post_id ON community_attachments(post_id);

-- ----------------------------------------------------------------------------
-- 3. COMMUNITY_COMMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_comments (
    id VARCHAR(50) PRIMARY KEY,
    post_id VARCHAR(50) NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    author_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content TEXT NOT NULL CHECK (length(trim(content)) > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'flagged')),
    parent_comment_id VARCHAR(50) REFERENCES community_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post_id ON community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_author_id ON community_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_parent_id ON community_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_created_at ON community_comments(created_at ASC);

-- ----------------------------------------------------------------------------
-- 4. COMMUNITY_LIKES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_likes (
    post_id VARCHAR(50) NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_likes_user_id ON community_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_community_likes_post_id ON community_likes(post_id);

-- ----------------------------------------------------------------------------
-- 5. COMMUNITY_BOOKMARKS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_bookmarks (
    post_id VARCHAR(50) NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_bookmarks_user_id ON community_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_community_bookmarks_post_id ON community_bookmarks(post_id);

-- ----------------------------------------------------------------------------
-- 6. LIBRARY_RESOURCES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS library_resources (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('books', 'guides', 'worksheets', 'exams', 'curriculum', 'research')),
    subject VARCHAR(100) NOT NULL,
    grade_level VARCHAR(50) NOT NULL,
    author_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    publisher_name VARCHAR(200),
    file_url VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    file_type VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'review', 'published', 'archived')),
    downloads_count INTEGER NOT NULL DEFAULT 0 CHECK (downloads_count >= 0),
    views_count INTEGER NOT NULL DEFAULT 0 CHECK (views_count >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_library_resources_category ON library_resources(category);
CREATE INDEX IF NOT EXISTS idx_library_resources_subject ON library_resources(subject);
CREATE INDEX IF NOT EXISTS idx_library_resources_grade_level ON library_resources(grade_level);
CREATE INDEX IF NOT EXISTS idx_library_resources_status ON library_resources(status);
CREATE INDEX IF NOT EXISTS idx_library_resources_downloads ON library_resources(downloads_count DESC);
CREATE INDEX IF NOT EXISTS idx_library_resources_created_at ON library_resources(created_at DESC);

-- ----------------------------------------------------------------------------
-- 7. CONTENT_ITEMS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_items (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('article', 'video', 'news', 'event', 'announcement')),
    subject VARCHAR(100),
    grade_level VARCHAR(50),
    author_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    thumbnail_url VARCHAR(500),
    video_url VARCHAR(500),
    read_time_minutes INTEGER DEFAULT 5 CHECK (read_time_minutes >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    views_count INTEGER NOT NULL DEFAULT 0 CHECK (views_count >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_items_category ON content_items(category);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_featured ON content_items(featured DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_created_at ON content_items(created_at DESC);

-- ----------------------------------------------------------------------------
-- 8. EVENT_DETAILS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_details (
    id VARCHAR(50) PRIMARY KEY,
    content_item_id VARCHAR(50) UNIQUE NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    location_type VARCHAR(20) NOT NULL CHECK (location_type IN ('virtual', 'in_person', 'hybrid')),
    location_address VARCHAR(300),
    speaker_name VARCHAR(200) NOT NULL,
    speaker_title VARCHAR(200),
    seats_capacity INTEGER NOT NULL CHECK (seats_capacity > 0),
    seats_booked INTEGER NOT NULL DEFAULT 0 CHECK (seats_booked >= 0 AND seats_booked <= seats_capacity),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_details_content_item_id ON event_details(content_item_id);
CREATE INDEX IF NOT EXISTS idx_event_details_event_date ON event_details(event_date ASC);

-- ----------------------------------------------------------------------------
-- 9. EVENT_REGISTRATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_registrations (
    id VARCHAR(50) PRIMARY KEY,
    event_id VARCHAR(50) NOT NULL REFERENCES event_details(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlisted', 'cancelled', 'attended')),
    registration_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_event_user_registration UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_user_id ON event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON event_registrations(status);

-- ----------------------------------------------------------------------------
-- 10. CONTACT_INQUIRIES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_inquiries (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL CHECK (length(trim(message)) > 0),
    portal_code VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'in_progress', 'resolved', 'closed')),
    admin_notes TEXT,
    assigned_to VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON contact_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_email ON contact_inquiries(email);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_user_id ON contact_inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created_at ON contact_inquiries(created_at DESC);
