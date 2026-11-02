# NEXORA — PHASE 2.2: Attendance Management Implementation
## Session-Based Attendance, Duplicate Prevention, and Analytics

**Document ID:** `NEXORA-P2.2-ATTENDANCE-IMPLEMENTATION`  
**Execution Phase:** Phase 2.2 — Classes, Students & Attendance  
**Status:** IMPLEMENTED & VERIFIED  
**Date:** March 2025  

---

### 1. Attendance Data Architecture

Attendance records are modeled in `student_attendance_records` (Migration 004):
- **Primary Identifier:** `id VARCHAR(50) PRIMARY KEY`.
- **Class Reference:** `class_id VARCHAR(50) NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE`.
- **Student Reference:** `student_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE`.
- **Date & Period:** `attendance_date DATE NOT NULL`, `session_number INT NOT NULL`.
- **Status Enum:** `status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused'))`.
- **Notes:** `notes TEXT`.
- **Auditing:** `recorded_by VARCHAR(50) REFERENCES users(id)`, `created_at`, `updated_at`.
- **Database Unique Constraint:**
  ```sql
  CONSTRAINT uq_student_attendance_session UNIQUE (class_id, student_id, attendance_date, session_number)
  ```

---

### 2. Supported Attendance Statuses & Domain Rules

| Status Code | Arabic Label | Color Theme & Tailwind Style | Description |
| :--- | :--- | :--- | :--- |
| **`present`** | حاضر | `bg-emerald-50 text-emerald-700 border-emerald-200` | Student attended on time and participated in class/lab. |
| **`absent`** | غائب | `bg-rose-50 text-rose-700 border-rose-200` | Student was absent without documented prior notice. |
| **`late`** | متأخر | `bg-amber-50 text-amber-700 border-amber-200` | Student arrived after the session commencement bell. |
| **`excused`** | معتذر | `bg-indigo-50 text-indigo-700 border-indigo-200` | Absence or tardiness supported by certified medical/school excuse. |

---

### 3. Core Attendance Operations

1. **Batch Atomic Session Recording (`POST /classes/:classId/attendance`):**
   - Receives full class roster records for a given date and session number.
   - Enforces class ownership check (`teacherId = req.user.id`).
   - Executes upsert (`ON CONFLICT (class_id, student_id, attendance_date, session_number) DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at`).
   - If executed in memory store, updates existing entries or appends new records.
   - Audits the event: `attendance.recorded` with session number and total count.
2. **Attendance Retrieval (`GET /classes/:classId/attendance?date=YYYY-MM-DD&session=N`):**
   - Retrieves records for specified date and optional session.
   - Joins student profile names to eliminate redundant client lookups.
3. **Single Record Modification (`PATCH /classes/:classId/attendance/:recordId`):**
   - Used when a student presents an official medical excuse after the period or corrects tardiness.
   - Validates class ownership before modifying status and notes.
4. **Attendance Analytics & KPI Summary (`GET /classes/:classId/attendance/summary`):**
   - Aggregates overall class statistics:
     - `total_sessions`: Distinct `(attendance_date, session_number)` periods recorded.
     - `total_records`: Cumulative student attendance entries.
     - `attendance_rate`: Percentage of `present` entries across all sessions.
     - `student_breakdown`: Individual student performance matrix:
       - `present_count`, `absent_count`, `late_count`, `excused_count`, and personalized `rate` percentage.
