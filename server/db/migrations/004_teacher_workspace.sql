-- ============================================================================
-- NEXORA Platform - Phase 2.1 Teacher Workspace Database Schema
-- Migration: 004_teacher_workspace.sql
-- Description: DDL for the 10 Teacher Workspace core relational tables:
--   1. teacher_classes
--   2. class_students
--   3. student_attendance_records
--   4. teacher_lesson_plans
--   5. lesson_plan_feedback
--   6. teacher_assignments
--   7. assignment_submissions
--   8. teacher_question_bank
--   9. teacher_assessments
--  10. in_app_notifications
-- Target Database: PostgreSQL 14+ (Supabase / Production Hostinger / Local Test DB)
-- Safety Note: Review-only script. NOT executed against databases in this phase.
-- ============================================================================

-- Ensure required cryptographic and UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TEACHER_CLASSES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_classes (
    id VARCHAR(50) PRIMARY KEY,
    teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    subject VARCHAR(100) NOT NULL DEFAULT 'كيمياء',
    grade_level VARCHAR(50) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    term VARCHAR(20) NOT NULL CHECK (term IN ('term_1', 'term_2', 'summer')),
    join_code VARCHAR(20) UNIQUE NOT NULL,
    room_number VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher_id ON teacher_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_join_code ON teacher_classes(join_code);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_status ON teacher_classes(status);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_grade_level ON teacher_classes(grade_level);

-- ----------------------------------------------------------------------------
-- 2. CLASS_STUDENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_students (
    id VARCHAR(50) PRIMARY KEY,
    class_id VARCHAR(50) NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'transferred', 'suspended')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_class_student UNIQUE (class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_class_students_class_id ON class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student_id ON class_students(student_id);
CREATE INDEX IF NOT EXISTS idx_class_students_status ON class_students(status);

-- ----------------------------------------------------------------------------
-- 3. STUDENT_ATTENDANCE_RECORDS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_attendance_records (
    id VARCHAR(50) PRIMARY KEY,
    class_id VARCHAR(50) NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    session_number INTEGER NOT NULL DEFAULT 1 CHECK (session_number >= 1 AND session_number <= 10),
    status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
    notes TEXT,
    recorded_by VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_student_attendance_session UNIQUE (class_id, student_id, attendance_date, session_number)
);

CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON student_attendance_records(class_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON student_attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON student_attendance_records(status);

-- ----------------------------------------------------------------------------
-- 4. TEACHER_LESSON_PLANS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_lesson_plans (
    id VARCHAR(50) PRIMARY KEY,
    teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(100) NOT NULL DEFAULT 'كيمياء',
    grade_level VARCHAR(50) NOT NULL,
    unit_name VARCHAR(150) NOT NULL,
    lesson_date DATE,
    learning_objectives TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    prior_knowledge TEXT,
    required_materials TEXT,
    instructional_procedures JSONB DEFAULT '[]'::jsonb,
    assessment_strategies TEXT,
    homework_description TEXT,
    differentiation_notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'archived')),
    reviewed_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher_id ON teacher_lesson_plans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_status ON teacher_lesson_plans(status);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_grade_level ON teacher_lesson_plans(grade_level);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_lesson_date ON teacher_lesson_plans(lesson_date);

-- ----------------------------------------------------------------------------
-- 5. LESSON_PLAN_FEEDBACK TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lesson_plan_feedback (
    id VARCHAR(50) PRIMARY KEY,
    plan_id VARCHAR(50) NOT NULL REFERENCES teacher_lesson_plans(id) ON DELETE CASCADE,
    supervisor_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    feedback_text TEXT NOT NULL CHECK (length(trim(feedback_text)) > 0),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    strengths TEXT,
    recommendations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_feedback_plan_id ON lesson_plan_feedback(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_feedback_supervisor_id ON lesson_plan_feedback(supervisor_id);

-- ----------------------------------------------------------------------------
-- 6. TEACHER_ASSIGNMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_assignments (
    id VARCHAR(50) PRIMARY KEY,
    class_id VARCHAR(50) NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
    teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    attachment_url VARCHAR(500),
    max_score NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (max_score > 0),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'closed', 'archived')),
    allow_late_submission BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON teacher_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON teacher_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON teacher_assignments(due_date ASC);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON teacher_assignments(status);

-- ----------------------------------------------------------------------------
-- 7. ASSIGNMENT_SUBMISSIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id VARCHAR(50) PRIMARY KEY,
    assignment_id VARCHAR(50) NOT NULL REFERENCES teacher_assignments(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_text TEXT,
    file_url VARCHAR(500),
    score NUMERIC(5,2) CHECK (score >= 0),
    feedback TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('pending', 'submitted', 'graded', 'late', 'resubmitted')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    graded_at TIMESTAMP WITH TIME ZONE,
    graded_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_assignment_student UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON assignment_submissions(status);

-- ----------------------------------------------------------------------------
-- 8. TEACHER_QUESTION_BANK TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_question_bank (
    id VARCHAR(50) PRIMARY KEY,
    teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL DEFAULT 'كيمياء',
    grade_level VARCHAR(50) NOT NULL,
    unit_name VARCHAR(150) NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(30) NOT NULL CHECK (question_type IN ('multiple_choice', 'essay', 'true_false', 'practical')),
    options JSONB DEFAULT '[]'::jsonb,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    cognitive_level VARCHAR(50) DEFAULT 'understanding' CHECK (cognitive_level IN ('knowledge', 'understanding', 'application', 'analysis', 'evaluation', 'creation')),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_question_bank_teacher_id ON teacher_question_bank(teacher_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_grade_unit ON teacher_question_bank(grade_level, unit_name);
CREATE INDEX IF NOT EXISTS idx_question_bank_difficulty ON teacher_question_bank(difficulty);
CREATE INDEX IF NOT EXISTS idx_question_bank_question_type ON teacher_question_bank(question_type);

-- ----------------------------------------------------------------------------
-- 9. TEACHER_ASSESSMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_assessments (
    id VARCHAR(50) PRIMARY KEY,
    class_id VARCHAR(50) NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
    teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 45 CHECK (duration_minutes > 0),
    total_score NUMERIC(5,2) NOT NULL DEFAULT 20.00 CHECK (total_score > 0),
    pass_score NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (pass_score >= 0 AND pass_score <= total_score),
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    scheduled_start TIMESTAMP WITH TIME ZONE,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'completed', 'archived')),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessments_class_id ON teacher_assessments(class_id);
CREATE INDEX IF NOT EXISTS idx_assessments_teacher_id ON teacher_assessments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON teacher_assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessments_schedule ON teacher_assessments(scheduled_start ASC);

-- ----------------------------------------------------------------------------
-- 10. IN_APP_NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS in_app_notifications (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('attendance', 'assignment', 'lesson_plan_feedback', 'assessment', 'system')),
    entity_id VARCHAR(50),
    action_url VARCHAR(300),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON in_app_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON in_app_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON in_app_notifications(created_at DESC);
