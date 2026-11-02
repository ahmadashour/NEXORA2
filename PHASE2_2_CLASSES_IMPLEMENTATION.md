# NEXORA — PHASE 2.2: Classroom Management Implementation
## Classroom Lifecycle, Scoping, and Join Code Architecture

**Document ID:** `NEXORA-P2.2-CLASSES-IMPLEMENTATION`  
**Execution Phase:** Phase 2.2 — Classes, Students & Attendance  
**Status:** IMPLEMENTED & VERIFIED  
**Date:** March 2025  

---

### 1. Classroom Data Structure & Relational Invariants

Classrooms are modeled in `teacher_classes` (Migration 004):
- **Primary Identifier:** `id VARCHAR(50) PRIMARY KEY` (`cls_<timestamp>_<hex>`).
- **Teacher Ownership:** `teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE`.
- **Unique Join Code:** `join_code VARCHAR(20) UNIQUE NOT NULL` formatted as `NX-<HEX>`.
- **Term Enum:** `term VARCHAR(20) NOT NULL CHECK (term IN ('term_1', 'term_2', 'summer'))`.
- **Status Enum:** `status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed'))`.
- **Auditing:** `created_at`, `updated_at`, `deleted_at`.

---

### 2. Implemented Classroom Operations

1. **`createClass(teacherId, classData)`:**
   - Validates required fields: `name` (>=2 chars), `grade_level`, `academic_year`, `term`.
   - Generates high-entropy cryptographic join code: `NX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`.
   - Enforces teacher identity derivation from server session context.
   - Dispatches audit log `class.created` to `activity_logs`.
2. **`listClasses(teacherId, options)`:**
   - Filters by `teacher_id = $1 AND status = $2 AND deleted_at IS NULL`.
   - Returns active or archived classes sorted by `created_at DESC`.
3. **`updateClass(teacherId, classId, data)`:**
   - Checks ownership (`teacher_id = teacherId`).
   - If class is archived, prohibits property updates unless unarchiving (`status = 'active'`).
   - Modifies attributes with updated timestamp.
4. **`archiveClass(teacherId, classId)`:**
   - Soft-archives class by setting `status = 'archived'`.
   - Immediately locks student self-enrollment and code redemption.
5. **`regenerateJoinCode(teacherId, classId)`:**
   - Checks ownership and active status.
   - Rotates `join_code` to a fresh unique random code.
   - Immediately invalidates previous join codes.
6. **`deactivateJoinCode(teacherId, classId)`:**
   - Sets code to `DISABLED-<hex>` so no further students can join.
7. **`getClassWithDetails(teacherId, classId)`:**
   - Computes aggregated live metrics: `student_count` (active students) and `attendance_rate` (percentage of present sessions).

---

### 3. Join Code Security & Collision Prevention

- **Collision Resistance:** Each code has 24 bits of crypto entropy (`NX-` + 6 hex chars = 16.7 million combinations per term).
- **Unique Constraint:** Enforced at PostgreSQL database level via `join_code VARCHAR(20) UNIQUE NOT NULL`.
- **Memory Store Guard:** In-memory fallback enforces unique index check before assigning codes.
- **Deactivation & Invalidation:** Teachers can regenerate codes at any time or archive the class, preventing unauthorized late joiners.
