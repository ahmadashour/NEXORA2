# NEXORA — PHASE 2.2: Student Enrollment & Roster Management
## Join Code Workflow, CSV Bulk Import & CWE-1236 Formula Injection Defense

**Document ID:** `NEXORA-P2.2-STUDENTS-ENROLLMENT`  
**Execution Phase:** Phase 2.2 — Classes, Students & Attendance  
**Status:** IMPLEMENTED & VERIFIED  
**Date:** March 2025  

---

### 1. Dual Enrollment Strategies

NEXORA Phase 2.2 supports two enrollment mechanisms:

#### A. Self-Enrollment via Unique Join Code (`POST /classes/join`)
1. Student enters class code (e.g. `NX-BCA982`).
2. Server normalizes code (case-insensitive, trims whitespace).
3. Server executes query for active, non-deleted class:
   - If not found -> `404 INVALID_JOIN_CODE`.
   - If class is archived or completed -> `400 CLASS_ARCHIVED`.
4. Server verifies whether student is already enrolled:
   - If active enrollment exists -> `409 STUDENT_ALREADY_ENROLLED`.
5. Inserts atomic record into `class_students(id, class_id, student_id, status='active')`.
6. Sanitized return: Only returns safe metadata (`class_name`, `subject`, `grade_level`, `academic_year`) and suppresses any roster or personally identifiable information of other enrolled students.

#### B. Bulk Roster Import via CSV / Excel Text (`validate-import` & `import`)
Designed for school registration offices and department heads importing entire rosters:
1. **Pre-Validation (`POST /classes/:classId/students/validate-import`):**
   - Inspects raw student records without touching the database.
   - Verifies required fields: student name (min 2 chars), and unique key (Civil ID or email).
   - In-memory duplicate detector flags repeated records inside the uploaded file.
   - Neutralizes formula injection vulnerabilities (see below).
   - Returns full preview summary: `{ total, valid_count, error_count, duplicate_count }` with row-by-row error details.
2. **Commit Import (`POST /classes/:classId/students/import`):**
   - Teacher reviews the validation report and confirms import.
   - Batch inserts valid records into `class_students` in a single atomic transaction.
   - Records audit log `students.imported`.

---

### 2. Formula Injection Sanitization (CWE-1236 Defense)

Spreadsheet exports often process student names or IDs in Microsoft Excel or Google Sheets. If an adversary submits names like `=cmd|'/C calc'!A0` or `@SUM(...)`, Excel executes dynamic DDE or formula evaluations.

NEXORA implements strict sanitization in `sanitizeCsvFormula()`:
```ts
export function sanitizeCsvFormula(value: string | undefined | null): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  // Strip or neutralize leading characters that trigger formula execution in Excel/Sheets
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}
```
Any entry starting with `=`, `+`, `-`, `@`, `\t`, or `\r` is safely escaped with a single quote prefix (`'`), forcing spreadsheet processors to treat the cell contents as plain text.

---

### 3. Student Identity & Current State Gap Analysis

- **Current State:** The system defines the `STUDENT` role in `DEFAULT_ROLES` and supports user registration with role code `STUDENT`.
- **Identity Gap Documented:** In schools without mandatory digital accounts, students may not yet have pre-provisioned NEXORA platform accounts.
- **Handling in Phase 2.2:**
  - Student identifiers (e.g., Civil ID numbers or school IDs like `std_20801`) are accepted in roster imports and stored in `class_students`.
  - When students log in or self-enroll, their authenticated session (`req.user.id`) binds to `class_students`.
  - In adherence to Phase 2.2 charter rules, no external SSO or third-party student directory service was created in this phase.
