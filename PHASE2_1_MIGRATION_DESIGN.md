# NEXORA — PHASE 2.1: Migration 004 Design & Schema Specification
## Teacher Workspace Database Foundation

**Status:** DESIGN COMPLETED & REVIEW-READY (NOT EXECUTED)  
**File Path:** `db/migrations/004_teacher_workspace.sql`  
**Target Engine:** PostgreSQL 14+ (Supabase / Production PostgreSQL / Isolated Test DB)  
**Safety Gate:** Migration is purely static and has NOT been run against any database instance.

---

### 1. Schema Design Rationale & 10 Tables Inventory

Migration 004 introduces ten interconnected tables specifically modeled for teacher productivity, classroom management, attendance tracking, lesson planning, assignment evaluation, and cross-role communication:

```
[users] 
  │
  ├───► [teacher_classes] ◄───────────────┐
  │         │                             │
  │         ├───► [class_students] ───────┤
  │         │         │                   │
  │         │         └──► [student_attendance_records]
  │         │
  │         ├───► [teacher_assignments] ◄───┐
  │         │         │                     │
  │         │         └──► [assignment_submissions]
  │         │
  │         └───► [teacher_assessments]
  │
  ├───► [teacher_lesson_plans]
  │         │
  │         └───► [lesson_plan_feedback] ◄── (LEAD / PRO Supervisors)
  │
  ├───► [teacher_question_bank]
  │
  └───► [in_app_notifications]
```

---

### 2. Comprehensive Table Specifications

#### 2.1 `teacher_classes` (Classroom Containers)
- **Primary Key:** `id VARCHAR(50)`
- **Foreign Key:** `teacher_id REFERENCES users(id) ON DELETE CASCADE`
- **Unique Constraint:** `join_code VARCHAR(20) UNIQUE NOT NULL` (ensures cryptographically unique student invitation codes).
- **Check Constraints:** `term IN ('term_1', 'term_2', 'summer')`, `status IN ('active', 'archived', 'completed')`.
- **Soft Delete:** `deleted_at TIMESTAMP WITH TIME ZONE`.

#### 2.2 `class_students` (Class Rosters)
- **Primary Key:** `id VARCHAR(50)`
- **Foreign Keys:** `class_id REFERENCES teacher_classes(id) ON DELETE CASCADE`, `student_id REFERENCES users(id) ON DELETE CASCADE`.
- **Unique Constraint:** `CONSTRAINT uq_class_student UNIQUE (class_id, student_id)` — strictly prevents adding a student twice to the same classroom roster.
- **Check Constraint:** `status IN ('active', 'dropped', 'transferred', 'suspended')`.

#### 2.3 `student_attendance_records` (Session Attendance)
- **Primary Key:** `id VARCHAR(50)`
- **Foreign Keys:** `class_id REFERENCES teacher_classes(id) ON DELETE CASCADE`, `student_id REFERENCES users(id) ON DELETE CASCADE`, `recorded_by REFERENCES users(id) ON DELETE RESTRICT`.
- **Period Duplicate Barrier:**
  ```sql
  CONSTRAINT uq_student_attendance_session UNIQUE (class_id, student_id, attendance_date, session_number)
  ```
  Guarantees that a student cannot have conflicting attendance marks for the same class on the same day during the same instructional period (1–10).
- **Check Constraints:** `session_number BETWEEN 1 AND 10`, `status IN ('present', 'absent', 'late', 'excused')`.

#### 2.4 `teacher_lesson_plans` (Curricular Preparation)
- **Primary Key:** `id VARCHAR(50)`
- **Foreign Keys:** `teacher_id REFERENCES users(id) ON DELETE CASCADE`, `reviewed_by REFERENCES users(id) ON DELETE SET NULL`.
- **Structural Fields:** `learning_objectives TEXT[]`, `instructional_procedures JSONB`, `differentiation_notes TEXT`.
- **Check Constraint:** `status IN ('draft', 'submitted', 'approved', 'rejected', 'archived')`.
- **Soft Delete:** `deleted_at TIMESTAMP WITH TIME ZONE`.

#### 2.5 `lesson_plan_feedback` (Supervisory Quality Review)
- **Primary Key:** `id VARCHAR(50)`
- **Foreign Keys:** `plan_id REFERENCES teacher_lesson_plans(id) ON DELETE CASCADE`, `supervisor_id REFERENCES users(id) ON DELETE RESTRICT`.
- **Check Constraints:** `length(trim(feedback_text)) > 0`, `rating BETWEEN 1 AND 5`.

#### 2.6 `teacher_assignments` (Homework & Practical Tasks)
- **Primary Key:** `id VARCHAR(50)`
- **Foreign Keys:** `class_id REFERENCES teacher_classes(id) ON DELETE CASCADE`, `teacher_id REFERENCES users(id) ON DELETE CASCADE`.
- **Check Constraints:** `max_score > 0`, `status IN ('draft', 'published', 'closed', 'archived')`.
- **Fields:** `allow_late_submission BOOLEAN`, `due_date TIMESTAMP WITH TIME ZONE`.

#### 2.7 `assignment_submissions` (Student Submissions)
- **Primary Key:** `id VARCHAR(50)`
- **Foreign Keys:** `assignment_id REFERENCES teacher_assignments(id) ON DELETE CASCADE`, `student_id REFERENCES users(id) ON DELETE CASCADE`, `graded_by REFERENCES users(id) ON DELETE SET NULL`.
- **Unique Constraint:** `CONSTRAINT uq_assignment_student UNIQUE (assignment_id, student_id)` — strictly enforces one submission record per student per assignment (with versioning/resubmission status tracking).
- **Check Constraints:** `score >= 0`, `status IN ('pending', 'submitted', 'graded', 'late', 'resubmitted')`.

#### 2.8 `teacher_question_bank` (Subject Question Items)
- **Primary Key:** `id VARCHAR(50)`
- **Foreign Key:** `teacher_id REFERENCES users(id) ON DELETE CASCADE`.
- **Check Constraints:** `difficulty IN ('easy', 'medium', 'hard')`, `question_type IN ('multiple_choice', 'essay', 'true_false', 'practical')`, `cognitive_level IN ('knowledge', 'understanding', 'application', 'analysis', 'evaluation', 'creation')`.
- **Fields:** `options JSONB`, `correct_answer TEXT`, `explanation TEXT`, `is_public BOOLEAN`.

#### 2.9 `teacher_assessments` (Formal Exams & Quizzes)
- **Primary Key:** `id VARCHAR(50)`
- **Foreign Keys:** `class_id REFERENCES teacher_classes(id) ON DELETE CASCADE`, `teacher_id REFERENCES users(id) ON DELETE CASCADE`.
- **Check Constraints:** `total_score > 0`, `pass_score >= 0 AND pass_score <= total_score`, `duration_minutes > 0`, `status IN ('draft', 'scheduled', 'active', 'completed', 'archived')`.
- **Fields:** `questions JSONB` (compiled list of selected question items and point weights).

#### 2.10 `in_app_notifications` (Real-Time Communication)
- **Primary Key:** `id VARCHAR(50)`
- **Foreign Key:** `user_id REFERENCES users(id) ON DELETE CASCADE`.
- **Check Constraint:** `type IN ('attendance', 'assignment', 'lesson_plan_feedback', 'assessment', 'system')`.
- **Fields:** `is_read BOOLEAN DEFAULT FALSE`, `read_at TIMESTAMP WITH TIME ZONE`, `action_url VARCHAR(300)`.

---

### 3. High-Performance Indexing Strategy

To guarantee sub-millisecond lookups, composite and foreign key indexes are established across high-traffic filters:
1. `idx_teacher_classes_teacher_id` & `idx_teacher_classes_join_code`: Fast classroom authorization and student join verification.
2. `idx_attendance_class_date`: Accelerates daily register queries (`WHERE class_id = $1 AND attendance_date = $2`).
3. `idx_assignments_class_id` & `idx_assignments_due_date`: Enables timely homework feeds and calendar integrations.
4. `idx_notifications_user_id` & `idx_notifications_is_read`: Instant unread badge count queries (`WHERE user_id = $1 AND is_read = FALSE`).

---

### 4. Rollback Analysis & Safety Precautions

If Migration 004 needs to be rolled back in a future phase:
- **Rollback SQL Script Pattern:**
  ```sql
  DROP TABLE IF EXISTS in_app_notifications CASCADE;
  DROP TABLE IF EXISTS assignment_submissions CASCADE;
  DROP TABLE IF EXISTS teacher_assignments CASCADE;
  DROP TABLE IF EXISTS lesson_plan_feedback CASCADE;
  DROP TABLE IF EXISTS teacher_lesson_plans CASCADE;
  DROP TABLE IF EXISTS student_attendance_records CASCADE;
  DROP TABLE IF EXISTS class_students CASCADE;
  DROP TABLE IF EXISTS teacher_assessments CASCADE;
  DROP TABLE IF EXISTS teacher_question_bank CASCADE;
  DROP TABLE IF EXISTS teacher_classes CASCADE;
  ```
- **Data Loss Risk:** Dropping tables will permanently remove student rosters, attendance histories, and lesson plans. In staging and production, backups must precede any migration execution.
- **Current Operational Guarantee:** This migration script is currently staged for static verification and code compilation only; zero database mutations have occurred.
