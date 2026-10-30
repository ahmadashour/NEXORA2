-- ============================================================================
-- NEXORA Platform - Phase 3.1 Core Relational Schema
-- Target Database: PostgreSQL 14+ (Compatible with Supabase & Hostinger External PostgreSQL)
-- Description: DDL for the 6 core tables supporting authentication, RBAC,
--              user profiles, and activity audits across the 6 NEXORA educational portals.
-- ============================================================================

-- Enable UUID extension if supported
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ROLES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default 6 Roles corresponding to NEXORA Portals
INSERT INTO roles (id, name, code, description, is_system_role)
VALUES 
    ('role_lead', 'موجه فني للعلوم', 'LEAD', 'إشراف تربوي ومتابعة جودة التعليم والتقارير الفنية', TRUE),
    ('role_pro', 'رئيس قسم علمي', 'PRO', 'إدارة القسم العلمي والمختبرات المدرسية وخطط الإنماء المهني', TRUE),
    ('role_teach', 'معلم علوم', 'TEACH', 'تحضير الدروس، إدارة الفصول، والتقويم الصفي والمختبري', TRUE),
    ('role_start', 'معلم متدرب / جديد', 'START', 'برامج التهيئة والمصاحبة المهنية وبنك التجارب التدريبية', TRUE),
    ('role_student', 'طالب', 'STUDENT', 'المختبرات الافتراضية، الأنشطة التفاعلية، وبنك الأسئلة', TRUE),
    ('role_family', 'ولي أمر', 'FAMILY', 'متابعة تقارير التحصيل الدراسي والتواصل الأكاديمي والأنشطة', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. PERMISSIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Core Module Permissions
INSERT INTO permissions (id, name, code, module, description)
VALUES 
    ('perm_view_dashboard', 'عرض لوحة التحكم', 'portal:view', 'portal', 'عرض لوحة تحكم البوابة المخصصة للمستخدم'),
    ('perm_manage_resources', 'إدارة الموارد التعليمية', 'resources:manage', 'resources', 'إضافة وتعديل وحذف الخطط والمذكرات'),
    ('perm_access_lab', 'استخدام المختبر الافتراضي', 'lab:access', 'lab', 'تشغيل محاكاة المختبر العلمي الافتراضي'),
    ('perm_access_ai', 'المساعد الذكي', 'ai:access', 'ai', 'استخدام المساعد الذكي في التحضير والاستفسار'),
    ('perm_view_reports', 'عرض التقارير الإشرافية', 'reports:view', 'reports', 'الاطلاع على مؤشرات الأداء والتقارير الميدانية'),
    ('perm_post_community', 'المشاركة في المجتمع', 'community:post', 'community', 'نشر مشاركات ومقالات في مجتمع معلمي العلوم')
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. ROLE_PERMISSIONS JUNCTION TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(50) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(50) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

-- Associate Core Permissions to Roles
INSERT INTO role_permissions (role_id, permission_id)
VALUES 
    ('role_lead', 'perm_view_dashboard'),
    ('role_lead', 'perm_view_reports'),
    ('role_lead', 'perm_access_ai'),
    ('role_pro', 'perm_view_dashboard'),
    ('role_pro', 'perm_manage_resources'),
    ('role_pro', 'perm_access_lab'),
    ('role_pro', 'perm_access_ai'),
    ('role_teach', 'perm_view_dashboard'),
    ('role_teach', 'perm_manage_resources'),
    ('role_teach', 'perm_access_lab'),
    ('role_teach', 'perm_access_ai'),
    ('role_teach', 'perm_post_community'),
    ('role_start', 'perm_view_dashboard'),
    ('role_start', 'perm_access_lab'),
    ('role_start', 'perm_access_ai'),
    ('role_student', 'perm_view_dashboard'),
    ('role_student', 'perm_access_lab'),
    ('role_family', 'perm_view_dashboard')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. USERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id VARCHAR(50) NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. USER_PROFILES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(30),
    school_or_org VARCHAR(200),
    district VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500),
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- ----------------------------------------------------------------------------
-- 6. ACTIVITY_LOGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 7. REVOKED_TOKENS TABLE (Phase 3.1.5B Persistent Session Revocation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);

