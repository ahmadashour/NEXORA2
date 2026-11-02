# NEXORA — PHASE 2.1: Pre-Execution Schema & Architecture Review
## Teacher Workspace Infrastructure & Database Foundation

**Status:** PRE-EXECUTION REVIEW COMPLETED  
**Date:** March 2025  
**Author:** NEXORA Architecture & Data Engineering Team  
**Scope:** Review of existing relational schema (001, 002), RBAC architecture, transactional integrity, notification subsystems, and structural gap analysis for Teacher Workspace.

---

### 1. Existing Relational Schema Analysis (Migrations 001 & 002)

The existing database foundations in `db/migrations/` comprise 17 tables across two migrations:

#### Migration 001 (`001_core_schema.sql`): Core Platform Tables (7 Tables)
1. **`roles`**: System roles with unique codes (`LEAD`, `PRO`, `TEACH`, `START`, `STUDENT`, `FAMILY`).
2. **`permissions`**: System capability identifiers (`portal:view`, `resources:manage`, `lab:access`, `ai:access`, `reports:view`, `community:post`).
3. **`role_permissions`**: Many-to-many junction binding roles to permissions.
4. **`users`**: Platform credentials, email verification, active status, foreign key to `roles(id)`.
5. **`user_profiles`**: User biographical and institutional data (`full_name`, `phone`, `school_or_org`, `district`, `avatar_url`, `preferences JSONB`).
6. **`activity_logs`**: Immutable audit trails (`user_id`, `action`, `entity_type`, `entity_id`, `ip_address`, `user_agent`).
7. **`revoked_tokens`**: Persistent token revocation table for session termination.

#### Migration 002 (`002_community_library_content.sql`): Domain Tables (10 Tables)
8. **`community_posts`**: Discussions, lesson questions, teacher advice.
9. **`community_attachments`**: Files attached to community posts.
10. **`community_comments`**: Nested comments and answers on posts.
11. **`community_likes`**: Atomic post likes.
12. **`community_bookmarks`**: User saved posts.
13. **`library_resources`**: Curricula books, PDFs, worksheets, exam banks.
14. **`content_items`**: Scientific articles, videos, announcements.
15. **`event_details`**: Workshops, interactive virtual webinars, seat capacities.
16. **`event_registrations`**: Attendee bookings, status tracking (`confirmed`, `waitlisted`, `cancelled`, `attended`).
17. **`contact_inquiries`**: Technical and academic support inquiries.

---

### 2. RBAC & Personas Deep-Dive: Teacher (`TEACH`) and Leadership Roles

The platform enforces strict role differentiation:
- **`TEACH` (Teacher)**: Primary persona for the workspace. Authorized to create classes, enroll students, take attendance, construct lesson plans, create homework assignments, and build personal question banks.
- **`PRO` (Department Head / Senior Teacher)**: Oversees departmental curriculum, reviews lesson plans, and conducts internal peer observations. Must NOT have carte blanche access to other departments or system-wide configuration.
- **`LEAD` (Educational Supervisor)**: High-level academic oversight across schools and districts. Can review lesson plans, provide supervisory feedback, and access macro-analytics.
- **`STUDENT`**: Enrolled in classes via join code. Can view assignments, submit homework, view personal attendance, and take assessments. Strictly barred from viewing other students' submissions or teacher planning documents.

---

### 3. Transaction Handling & Connection Pooling (`withTransaction`)

Inspected in `server/db/postgres.ts`:
- Connection pooling managed via `pg.Pool` (Max 20 connections, 30s idle timeout).
- Transaction execution via `withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>`:
  - Automates `BEGIN`, `COMMIT`, and `ROLLBACK` on unhandled errors.
  - Ensures atomic operations (e.g., student roster updates, attendance recording across an entire class period).
- In-memory mock fallback strictly prohibited in `NODE_ENV === 'production'`.

---

### 4. Existing Notification Subsystem Review

- **Finding:** Currently, there is **NO database table** or backend service for in-app notifications.
- The UI contains only a transient local state string inside `src/components/modals/PortalModal.tsx`.
- **Verdict:** Introducing `in_app_notifications` in Migration 004 is non-redundant and provides the foundation for real-time alerts across teachers, students, and supervisors.

---

### 5. Gap Analysis: The 10 Proposed Tables vs Existing Schema

| Proposed Table | Status in Current DB | Structural Need & Justification |
| :--- | :---: | :--- |
| **`teacher_classes`** | **Missing** | Essential container for academic sections, grade levels, academic years, terms, and student join codes. |
| **`class_students`** | **Missing** | Junction table mapping students (`users.id`) to classes with enrollment status. |
| **`student_attendance_records`** | **Missing** | Granular daily/session attendance tracking with multi-column unique constraint to prevent period duplicates. |
| **`teacher_lesson_plans`** | **Missing** | Structured pedagogical planning with objectives, procedures, and supervisory review workflow. |
| **`lesson_plan_feedback`** | **Missing** | Formal supervisory feedback mechanism linking `LEAD`/`PRO` to specific lesson plans. |
| **`teacher_assignments`** | **Missing** | Homework and laboratory assignment definitions, due dates, and grading rubrics. |
| **`assignment_submissions`** | **Missing** | Student work submission records, grading, scores, and teacher comments. |
| **`teacher_question_bank`** | **Missing** | Chemistry question repository categorized by unit, difficulty, and Bloom's taxonomy level. |
| **`teacher_assessments`** | **Missing** | Quizzes, midterms, and lab practical assessments generated from question banks. |
| **`in_app_notifications`** | **Missing** | In-app alerts for attendance warnings, assignment due dates, and supervisor feedback. |

**Conclusion:** All 10 proposed tables are strictly necessary, completely non-redundant with existing tables, and constitute the complete relational foundation for Phase 2.
