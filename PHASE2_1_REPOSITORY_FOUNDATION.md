# NEXORA — PHASE 2.1: Teacher Workspace Repository Foundation
## Data Access Layer & Security Scoping Documentation

**Status:** FOUNDATION IMPLEMENTED & VERIFIED  
**File Path:** `server/db/repositories/teacherRepository.ts`  
**Pattern:** Scoped Domain Repository Pattern with Dual-Mode Persistence (PostgreSQL / In-Memory Resilient Store)  
**Date:** March 2025  

---

### 1. Architectural Philosophy: Zero Trust in Client Parameters

In conventional naive architectures, endpoints accept parameters like `teacher_id` from client payloads. This creates severe IDOR (Insecure Direct Object Reference) vulnerabilities where malicious actors alter query parameters to inspect or modify other teachers' classes or students.

In NEXORA Phase 2.1:
- Every data access method requires `teacherId` / `userId` as its first parameter.
- This identity is **strictly extracted from verified server JWT claims or HttpOnly sessions**, never from HTTP request bodies or query parameters.
- All SQL queries and in-memory searches automatically append `WHERE teacher_id = $1` or perform owner assertions prior to mutating state.

---

### 2. Implemented Repository Subsystems

#### 2.1 Classroom Management (`TeacherClass`)
- `createClass(teacherId, data)`: Generates cryptographic IDs (`cls_*`) and a human-friendly unique join code (`NX-XXXXXX`), sets academic year, grade level, and term.
- `listClasses(teacherId, options)`: Returns classrooms owned exclusively by the authenticated teacher.
- `getClassById(teacherId, classId)`: Retrieves classroom details with strict ownership verification; returns `null` if the class belongs to another instructor.

#### 2.2 Student Rostering & Attendance (`ClassStudent`, `StudentAttendanceRecord`)
- `enrollStudent(teacherId, classId, studentId)`: Adds a student to the class roster after asserting the teacher owns the class (`ClassAccessDeniedError` if violated).
- `listClassStudents(teacherId, classId)`: Retrieves class roster with joined student profiles.
- `recordAttendance(teacherId, classId, records)`:
  - Validates class ownership.
  - Implements atomic upsert matching PostgreSQL `ON CONFLICT (class_id, student_id, attendance_date, session_number) DO UPDATE`.
  - Prevents duplicate attendance marks for a student within the same instructional session.

#### 2.3 Curricular Planning & Supervisory Review (`TeacherLessonPlan`, `LessonPlanFeedback`)
- `createLessonPlan(teacherId, data)`: Establishes draft pedagogical plans with objectives, materials, procedures JSONB, and differentiation notes.
- `getLessonPlanById(userId, role, planId)`:
  - If the user has role `TEACH`, access is restricted to their own lesson plans (`LessonPlanAccessDeniedError` if another teacher's plan is requested).
  - If the user has supervisory roles (`LEAD` or `PRO`), reading access is granted for academic oversight.
- `addSupervisoryFeedback(supervisorId, supervisorRole, planId, feedback)`:
  - Restricted strictly to `LEAD` and `PRO`.
  - Records detailed supervisory feedback, rating (1–5), strengths, and recommendations.
  - Optionally transitions the lesson plan status to `approved` or `rejected`.

#### 2.4 Homework & Assessments (`TeacherAssignment`, `AssignmentSubmission`)
- `createAssignment(teacherId, data)`: Publishes homework tasks linked to authorized classes with due dates and maximum scores.
- `gradeSubmission(teacherId, submissionId, score, feedback)`: Joins submissions against `teacher_assignments` to verify that only the assigned teacher can award marks and feedback.

#### 2.5 In-App Communication (`InAppNotification`)
- `sendNotification(userId, notification)`: Dispatches real-time alerts for attendance, feedback, and assignments.
- `getUserNotifications(userId)`: Scoped retrieval ensuring zero cross-user message leakage.
- `markNotificationRead(userId, notificationId)`: Allows recipient to acknowledge notifications.

---

### 3. Dual-Mode Storage Architecture

The repository layer automatically detects environment configuration:
- In production / staging with `DATABASE_URL`: Executes parameterized SQL queries with transactional rollbacks (`withTransaction`).
- In offline test / isolated sandbox mode: Runs against memory stores (`Map`/`Set`) enforcing identical unique constraints and authorization checks.
