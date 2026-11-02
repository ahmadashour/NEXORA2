# NEXORA — PHASE 2.2: RESTful API Design & Endpoint Specification
## Classes, Students & Attendance Endpoints (`/api/v1/teacher/*`)

**Document ID:** `NEXORA-P2.2-API-DESIGN`  
**Execution Phase:** Phase 2.2 — Classes, Students & Attendance  
**Status:** IMPLEMENTED & VERIFIED  
**Date:** March 2025  
**Base URL:** `/api/v1/teacher`  
**Authentication:** Bearer JWT Header (`Authorization: Bearer <token>`) or HttpOnly Cookie (`nexora_token`)  
**CSRF Defense:** Double-submit cookie with required `X-CSRF-Token` header for state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`)  

---

### 1. Architectural Philosophy & Zero-Trust Design

1. **Server-Derived Identity:**  
   The teacher's identity (`teacherId`) is **never accepted** from query parameters or request payloads. It is strictly derived from the validated JWT token claims on the server (`req.user.id`).
2. **Anti-IDOR Enforcement:**  
   Before inspecting, mutating, archiving, or listing students/attendance for any class, the server explicitly queries `teacher_classes` filtered by `id = $classId AND teacher_id = $teacherId`. If the class is not owned by the requesting teacher, an immediate `403 Forbidden` (`FORBIDDEN_CLASS_ACCESS`) is returned.
3. **Role-Based Access Control (RBAC):**  
   - `TEACH`, `PRO`, `ADMIN`: Full management of classes, rosters, and attendance.
   - `LEAD`: Read-only supervisory inspection across school districts.
   - `STUDENT`: Permitted only to join an active class via `POST /classes/join`. Barred from class creation or attendance mutations.

---

### 2. Comprehensive Endpoint Matrix

| Method | Endpoint Route | Authorized Roles | Request Body / Query Params | Success Code & Response | Error Codes |
| :--- | :--- | :---: | :--- | :---: | :--- |
| **GET** | `/classes` | `TEACH`, `PRO`, `LEAD`, `ADMIN` | Query: `status` (`active` \| `archived` \| `completed`) | `200 OK`<br>`{ success: true, data: TeacherClassModel[], count: N }` | `401 UNAUTHORIZED`<br>`403 FORBIDDEN_ROLE` |
| **POST** | `/classes` | `TEACH`, `PRO`, `ADMIN` | Body: `{ name, grade_level, academic_year, term, subject?, room_number? }` | `201 Created`<br>`{ success: true, data: TeacherClassModel }` | `400 VALIDATION_ERROR`<br>`403 FORBIDDEN_ROLE` |
| **GET** | `/classes/:classId` | `TEACH`, `PRO`, `LEAD`, `ADMIN` | URL Param: `classId` | `200 OK`<br>`{ success: true, data: TeacherClassWithStats }` | `403 FORBIDDEN_CLASS_ACCESS`<br>`404 CLASS_NOT_FOUND` |
| **PUT** | `/classes/:classId` | `TEACH`, `PRO`, `ADMIN` | Body: `{ name?, grade_level?, academic_year?, term?, subject?, room_number? }` | `200 OK`<br>`{ success: true, data: TeacherClassModel }` | `400 CLASS_ARCHIVED`<br>`403 FORBIDDEN_CLASS_ACCESS` |
| **POST** | `/classes/:classId/archive` | `TEACH`, `PRO`, `ADMIN` | URL Param: `classId` | `200 OK`<br>`{ success: true, data: TeacherClassModel }` | `403 FORBIDDEN_CLASS_ACCESS` |
| **POST** | `/classes/:classId/regenerate-code` | `TEACH`, `PRO`, `ADMIN` | URL Param: `classId` | `200 OK`<br>`{ success: true, data: { join_code: string } }` | `400 CLASS_ARCHIVED`<br>`403 FORBIDDEN_CLASS_ACCESS` |
| **POST** | `/classes/:classId/deactivate-code` | `TEACH`, `PRO`, `ADMIN` | URL Param: `classId` | `200 OK`<br>`{ success: true, data: { join_code, is_active: false } }` | `403 FORBIDDEN_CLASS_ACCESS` |
| **POST** | `/classes/join` | Any Authenticated (e.g. `STUDENT`) | Body: `{ join_code: string }` | `200 OK`<br>`{ success: true, data: SanitizedClassInfo }` | `400 CLASS_ARCHIVED`<br>`404 INVALID_JOIN_CODE`<br>`409 STUDENT_ALREADY_ENROLLED` |
| **GET** | `/classes/:classId/students` | `TEACH`, `PRO`, `LEAD`, `ADMIN` | URL Param: `classId` | `200 OK`<br>`{ success: true, data: ClassStudentModel[], count: N }` | `403 FORBIDDEN_CLASS_ACCESS` |
| **POST** | `/classes/:classId/students` | `TEACH`, `PRO`, `ADMIN` | Body: `{ student_id: string }` | `201 Created`<br>`{ success: true, data: ClassStudentModel }` | `400 VALIDATION_ERROR`<br>`403 FORBIDDEN_CLASS_ACCESS` |
| **DELETE** | `/classes/:classId/students/:studentId` | `TEACH`, `PRO`, `ADMIN` | URL Params: `classId`, `studentId` | `200 OK`<br>`{ success: true, message: string }` | `403 FORBIDDEN_CLASS_ACCESS`<br>`404 STUDENT_NOT_FOUND` |
| **POST** | `/classes/:classId/students/validate-import` | `TEACH`, `PRO`, `ADMIN` | Body: `{ records: Array<{ name, student_id, email, ... }> }` | `200 OK`<br>`{ success: true, data: ValidationResult }` | `400 INVALID_CSV_PAYLOAD`<br>`403 FORBIDDEN_CLASS_ACCESS` |
| **POST** | `/classes/:classId/students/import` | `TEACH`, `PRO`, `ADMIN` | Body: `{ students: Array<{ student_id, student_name, student_email }> }` | `200 OK`<br>`{ success: true, data: { imported_count, students } }` | `400 INVALID_PAYLOAD`<br>`403 FORBIDDEN_CLASS_ACCESS` |
| **GET** | `/classes/:classId/attendance` | `TEACH`, `PRO`, `LEAD`, `ADMIN` | Query: `date` (YYYY-MM-DD), `session?` (1-7) | `200 OK`<br>`{ success: true, data: AttendanceRecordModel[] }` | `400 VALIDATION_ERROR`<br>`403 FORBIDDEN_CLASS_ACCESS` |
| **POST** | `/classes/:classId/attendance` | `TEACH`, `PRO`, `ADMIN` | Body: `{ records: Array<{ student_id, attendance_date, session_number, status, notes? }> }` | `200 OK`<br>`{ success: true, data: AttendanceRecordModel[] }` | `400 INVALID_ATTENDANCE_STATUS`<br>`403 FORBIDDEN_CLASS_ACCESS`<br>`409 DUPLICATE_ATTENDANCE` |
| **PATCH** | `/classes/:classId/attendance/:recordId` | `TEACH`, `PRO`, `ADMIN` | Body: `{ status: 'present' \| 'absent' \| 'late' \| 'excused', notes? }` | `200 OK`<br>`{ success: true, data: AttendanceRecordModel }` | `400 INVALID_ATTENDANCE_STATUS`<br>`403 FORBIDDEN_CLASS_ACCESS` |
| **GET** | `/classes/:classId/attendance/summary` | `TEACH`, `PRO`, `LEAD`, `ADMIN` | URL Param: `classId` | `200 OK`<br>`{ success: true, data: AttendanceSummaryModel }` | `403 FORBIDDEN_CLASS_ACCESS` |

---

### 3. Detailed Payload & Response Specifications

#### 3.1 Class Creation (`POST /classes`)
- **Request:**
  ```json
  {
    "name": "فصل الثاني عشر علمي / 1",
    "grade_level": "الصف الثاني عشر علمي",
    "academic_year": "2024/2025",
    "term": "term_2",
    "subject": "كيمياء",
    "room_number": "مختبر الكيمياء رقم 2"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": "cls_1793610064965_6c8f8d3f",
      "teacher_id": "usr_t_ahmad_1793610064901",
      "name": "فصل الثاني عشر علمي / 1",
      "subject": "كيمياء",
      "grade_level": "الصف الثاني عشر علمي",
      "academic_year": "2024/2025",
      "term": "term_2",
      "join_code": "NX-BCA982",
      "room_number": "مختبر الكيمياء رقم 2",
      "status": "active",
      "created_at": "2025-03-02T09:01:04.965Z",
      "updated_at": "2025-03-02T09:01:04.965Z"
    },
    "message": "تم إنشاء الفصل الدراسي ورمز الانضمام بنجاح"
  }
  ```

#### 3.2 Student Self-Join (`POST /classes/join`)
- **Request:**
  ```json
  {
    "join_code": "NX-BCA982"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "class_id": "cls_1793610064965_6c8f8d3f",
      "class_name": "فصل الثاني عشر علمي / 1",
      "subject": "كيمياء",
      "grade_level": "الصف الثاني عشر علمي",
      "academic_year": "2024/2025",
      "term": "term_2"
    },
    "message": "تم الانضمام بنجاح إلى فصل: فصل الثاني عشر علمي / 1"
  }
  ```
- *Security Note:* The response purposefully omits the roster list of other enrolled students to preserve student privacy.

#### 3.3 Batch Session Attendance (`POST /classes/:classId/attendance`)
- **Request:**
  ```json
  {
    "records": [
      {
        "student_id": "usr_s_khalid_101",
        "attendance_date": "2025-03-10",
        "session_number": 1,
        "status": "present",
        "notes": "حضور مبكر"
      },
      {
        "student_id": "usr_s_omar_102",
        "attendance_date": "2025-03-10",
        "session_number": 1,
        "status": "late",
        "notes": "تأخر 5 دقائق"
      }
    ]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [...],
    "count": 2,
    "message": "تم رصد حضور وغياب 2 طالب بنجاح"
  }
  ```
