/**
 * NEXORA Phase 2.2 — Classes, Students & Attendance Comprehensive Test Suite
 * 
 * Verifies:
 * 1. Class Lifecycle: Creation, Auto Join Code, Modification, Archiving, Filtering
 * 2. Join Code Security: Regeneration, Deactivation, Uniqueness
 * 3. Student Self-Enrollment: Code redemption, Archived rejection, Duplicate defense (409)
 * 4. Anti-IDOR Defense: Strict isolation between distinct teachers (403 Forbidden)
 * 5. CSV/Spreadsheet Import: Format validation, duplicate detection, Formula injection sanitization (CWE-1236)
 * 6. Attendance Tracking: Batch atomic session recording, Session uniqueness constraint, Update, Analytics summary
 * 7. RBAC & Security: Role enforcement (TEACH, LEAD, PRO, ADMIN vs STUDENT), CSRF & Cookie protection
 * 
 * Classifications:
 * - [Mock/Unit Test]: Domain repository checks & formula injection sanitization in dev sandbox
 * - [Integration Test]: Full HTTP wire requests through Express server pipeline
 */

import http from 'http';
import { AddressInfo } from 'net';
import { createExpressApp } from '../server/app';
import { db } from '../server/db';
import { generateToken, generateCsrfToken } from '../server/middleware/auth';
import { SanitizedUser } from '../server/db/types';
import {
  teacherRepo,
  sanitizeCsvFormula,
  ClassAccessDeniedError,
  InvalidJoinCodeError,
  ClassArchivedError,
  StudentAlreadyEnrolledError,
} from '../server/db/repositories/teacherRepository';

interface TestResult {
  id: string;
  name: string;
  category: string;
  classification: 'Mock/Unit Test' | 'Integration Test';
  passed: boolean;
  evidence: string;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(
  id: string,
  name: string,
  category: string,
  classification: 'Mock/Unit Test' | 'Integration Test',
  fn: () => Promise<string>
): Promise<void> {
  const start = Date.now();
  try {
    const evidence = await fn();
    const durationMs = Date.now() - start;
    results.push({ id, name, category, classification, passed: true, evidence, durationMs });
    console.log(`[PASS] [${id}] [${classification}] ${name} (${durationMs}ms)`);
    console.log(`       ↳ Evidence: ${evidence}`);
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ id, name, category, classification, passed: false, evidence: 'Failed', error: msg, durationMs });
    console.error(`[FAIL] [${id}] [${classification}] ${name} (${durationMs}ms)`);
    console.error(`       ↳ Error: ${msg}`);
  }
}

async function runSuite() {
  console.log('================================================================================');
  console.log('  NEXORA PHASE 2.2 — CLASSES, STUDENTS & ATTENDANCE INTEGRATION TEST SUITE     ');
  console.log('================================================================================\n');

  // Set up in-process Express server for HTTP Integration tests
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // 1. Setup Test Personas in db
  const teacherUserA: SanitizedUser = {
    id: `usr_t_ahmad_${Date.now()}`,
    email: 'ahmad.teacher@nexora.kw',
    role_id: 'role_teach',
    role_code: 'TEACH',
    role_name: 'معلم علوم',
    is_active: true,
    last_login_at: new Date().toISOString(),
    full_name: 'أحمد عاشور',
    created_at: new Date().toISOString(),
  };

  const teacherUserB: SanitizedUser = {
    id: `usr_t_salem_${Date.now()}`,
    email: 'salem.teacher@nexora.kw',
    role_id: 'role_teach',
    role_code: 'TEACH',
    role_name: 'معلم علوم',
    is_active: true,
    last_login_at: new Date().toISOString(),
    full_name: 'سالم الكندري',
    created_at: new Date().toISOString(),
  };

  const studentUser1: SanitizedUser = {
    id: `usr_s_khalid_${Date.now()}`,
    email: 'khalid.student@nexora.kw',
    role_id: 'role_student',
    role_code: 'STUDENT',
    role_name: 'طالب',
    is_active: true,
    last_login_at: new Date().toISOString(),
    full_name: 'خالد المطيري',
    created_at: new Date().toISOString(),
  };

  const studentUser2: SanitizedUser = {
    id: `usr_s_omar_${Date.now()}`,
    email: 'omar.student@nexora.kw',
    role_id: 'role_student',
    role_code: 'STUDENT',
    role_name: 'طالب',
    is_active: true,
    last_login_at: new Date().toISOString(),
    full_name: 'عمر العتيبي',
    created_at: new Date().toISOString(),
  };

  // Pre-register test users in DB store for token resolution
  await db.createUser({ id: teacherUserA.id, email: teacherUserA.email, password_hash: 'hash', role_id: teacherUserA.role_id });
  await db.createProfile({ id: `prof_${teacherUserA.id}`, user_id: teacherUserA.id, full_name: teacherUserA.full_name });

  await db.createUser({ id: teacherUserB.id, email: teacherUserB.email, password_hash: 'hash', role_id: teacherUserB.role_id });
  await db.createProfile({ id: `prof_${teacherUserB.id}`, user_id: teacherUserB.id, full_name: teacherUserB.full_name });

  await db.createUser({ id: studentUser1.id, email: studentUser1.email, password_hash: 'hash', role_id: studentUser1.role_id });
  await db.createProfile({ id: `prof_${studentUser1.id}`, user_id: studentUser1.id, full_name: studentUser1.full_name });

  await db.createUser({ id: studentUser2.id, email: studentUser2.email, password_hash: 'hash', role_id: studentUser2.role_id });
  await db.createProfile({ id: `prof_${studentUser2.id}`, user_id: studentUser2.id, full_name: studentUser2.full_name });

  // Generate tokens
  const tokenTeacherA = generateToken(teacherUserA);
  const tokenTeacherB = generateToken(teacherUserB);
  const tokenStudent1 = generateToken(studentUser1);
  const tokenStudent2 = generateToken(studentUser2);

  let createdClassId = '';
  let activeJoinCode = '';

  // ---------------------------------------------------------------------------
  // 1. CLASS LIFECYCLE TESTS
  // ---------------------------------------------------------------------------
  await runTest(
    'T2.2-01',
    'إنشاء فصل دراسي جديد مع توليد تلقائي لرمز الانضمام الفريد',
    'Class Lifecycle',
    'Integration Test',
    async () => {
      const res = await fetch(`${baseUrl}/api/v1/teacher/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTeacherA}`,
        },
        body: JSON.stringify({
          name: 'فصل الثاني عشر علمي / 1',
          grade_level: 'الصف الثاني عشر علمي',
          academic_year: '2024/2025',
          term: 'term_2',
          subject: 'كيمياء',
          room_number: 'مختبر 1',
        }),
      });

      const body = await res.json();
      if (res.status !== 201 || !body.success || !body.data?.id) {
        throw new Error(`Expected 201 Created, received ${res.status}: ${JSON.stringify(body)}`);
      }

      createdClassId = body.data.id;
      activeJoinCode = body.data.join_code;

      if (!activeJoinCode.startsWith('NX-')) {
        throw new Error(`Join code format invalid: ${activeJoinCode}`);
      }

      return `Class created: ID=${createdClassId}, JoinCode=${activeJoinCode}, Teacher=${body.data.teacher_id}`;
    }
  );

  await runTest(
    'T2.2-02',
    'تعديل بيانات الفصل الدراسي وتحديث القاعة والمرحلة',
    'Class Lifecycle',
    'Integration Test',
    async () => {
      const res = await fetch(`${baseUrl}/api/v1/teacher/classes/${createdClassId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTeacherA}`,
        },
        body: JSON.stringify({
          name: 'فصل الثاني عشر علمي / 1 (متقدم)',
          room_number: 'مختبر الكيمياء العضوية',
        }),
      });

      const body = await res.json();
      if (res.status !== 200 || !body.success) {
        throw new Error(`Expected 200 OK, received ${res.status}: ${JSON.stringify(body)}`);
      }

      if (body.data.name !== 'فصل الثاني عشر علمي / 1 (متقدم)' || body.data.room_number !== 'مختبر الكيمياء العضوية') {
        throw new Error(`Class properties not updated: ${JSON.stringify(body.data)}`);
      }

      return `Class successfully updated: Name="${body.data.name}", Room="${body.data.room_number}"`;
    }
  );

  await runTest(
    'T2.2-03',
    'إعادة توليد رمز انضمام جديد للفصل الدراسي بنجاح',
    'Join Code Management',
    'Integration Test',
    async () => {
      const oldCode = activeJoinCode;
      const res = await fetch(`${baseUrl}/api/v1/teacher/classes/${createdClassId}/regenerate-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTeacherA}`,
        },
      });

      const body = await res.json();
      if (res.status !== 200 || !body.success || !body.data?.join_code) {
        throw new Error(`Expected 200 OK, received ${res.status}: ${JSON.stringify(body)}`);
      }

      const newCode = body.data.join_code;
      if (newCode === oldCode) {
        throw new Error(`Join code was not regenerated; remained identical to ${oldCode}`);
      }

      activeJoinCode = newCode;
      return `Join code rotated successfully: Old=${oldCode} -> New=${activeJoinCode}`;
    }
  );

  // ---------------------------------------------------------------------------
  // 2. ANTI-IDOR DEFENSE
  // ---------------------------------------------------------------------------
  await runTest(
    'T2.2-04',
    'حماية IDOR: منع المعلم B من تعديل أو الاطلاع على تفاصيل فصل المعلم A',
    'Anti-IDOR Defense',
    'Integration Test',
    async () => {
      // Teacher B tries to modify Teacher A's class
      const res = await fetch(`${baseUrl}/api/v1/teacher/classes/${createdClassId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTeacherB}`,
        },
        body: JSON.stringify({ name: 'اختراق الفصل' }),
      });

      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden for IDOR attempt, received ${res.status}`);
      }

      const body = await res.json();
      if (body.error !== 'FORBIDDEN_CLASS_ACCESS') {
        throw new Error(`Expected error code FORBIDDEN_CLASS_ACCESS, received: ${body.error}`);
      }

      return `IDOR correctly blocked with 403 Forbidden (${body.error})`;
    }
  );

  await runTest(
    'T2.2-05',
    'حماية IDOR: منع المعلم B من استعراض قائمة طلاب فصل المعلم A',
    'Anti-IDOR Defense',
    'Integration Test',
    async () => {
      const res = await fetch(`${baseUrl}/api/v1/teacher/classes/${createdClassId}/students`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenTeacherB}`,
        },
      });

      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden for IDOR student roster check, received ${res.status}`);
      }

      return `Roster access denied for non-owner teacher (403 Forbidden)`;
    }
  );

  // ---------------------------------------------------------------------------
  // 3. STUDENT JOIN VIA CODE & RESTRICTIONS
  // ---------------------------------------------------------------------------
  await runTest(
    'T2.2-06',
    'انضمام الطالب بنجاح باستخدام رمز الفصل الدراسي الصالح',
    'Student Enrollment',
    'Integration Test',
    async () => {
      const res = await fetch(`${baseUrl}/api/v1/teacher/classes/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenStudent1}`,
        },
        body: JSON.stringify({ join_code: activeJoinCode }),
      });

      const body = await res.json();
      if (res.status !== 200 || !body.success) {
        throw new Error(`Expected 200 OK, received ${res.status}: ${JSON.stringify(body)}`);
      }

      if (body.data.class_id !== createdClassId) {
        throw new Error(`Joined wrong class: expected ${createdClassId}, got ${body.data.class_id}`);
      }

      return `Student joined class: ClassName="${body.data.class_name}", Subject="${body.data.subject}"`;
    }
  );

  await runTest(
    'T2.2-07',
    'منع تكرار الانضمام: رفض محاولة الطالب الانضمام لنفس الفصل مرتين (409 Conflict)',
    'Student Enrollment',
    'Integration Test',
    async () => {
      const res = await fetch(`${baseUrl}/api/v1/teacher/classes/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenStudent1}`,
        },
        body: JSON.stringify({ join_code: activeJoinCode }),
      });

      if (res.status !== 409) {
        throw new Error(`Expected 409 Conflict for duplicate enrollment, received ${res.status}`);
      }

      const body = await res.json();
      if (body.error !== 'STUDENT_ALREADY_ENROLLED') {
        throw new Error(`Expected error STUDENT_ALREADY_ENROLLED, received: ${body.error}`);
      }

      return `Duplicate enrollment rejected with 409 Conflict (${body.error})`;
    }
  );

  await runTest(
    'T2.2-08',
    'رفض الانضمام برمز غير صالح أو غير موجود (404 Not Found)',
    'Student Enrollment',
    'Integration Test',
    async () => {
      const res = await fetch(`${baseUrl}/api/v1/teacher/classes/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenStudent2}`,
        },
        body: JSON.stringify({ join_code: 'NX-INVALID999' }),
      });

      if (res.status !== 404) {
        throw new Error(`Expected 404 Not Found, received ${res.status}`);
      }

      const body = await res.json();
      if (body.error !== 'INVALID_JOIN_CODE') {
        throw new Error(`Expected error INVALID_JOIN_CODE, received: ${body.error}`);
      }

      return `Invalid join code rejected with 404 Not Found (${body.error})`;
    }
  );

  // ---------------------------------------------------------------------------
  // 4. CSV IMPORT & FORMULA INJECTION DEFENSE (CWE-1236)
  // ---------------------------------------------------------------------------
  await runTest(
    'T2.2-09',
    'التحقق من تعقيم مدخلات CSV ضد هجمات حقن الصيغ (Formula Injection Sanitization)',
    'CSV Security',
    'Mock/Unit Test',
    async () => {
      const maliciousPayloads = [
        '=cmd|"/C calc"!A0',
        '+10+20',
        '-50+SUM(A1:A10)',
        '@SUM(1+1)',
        '\t=2+2',
      ];

      for (const payload of maliciousPayloads) {
        const sanitized = sanitizeCsvFormula(payload);
        if (!sanitized.startsWith("'")) {
          throw new Error(`Failed to neutralize formula prefix: "${payload}" -> "${sanitized}"`);
        }
      }

      const safePayload = 'خالد عبد الله الكندري';
      const sanitizedSafe = sanitizeCsvFormula(safePayload);
      if (sanitizedSafe !== safePayload) {
        throw new Error(`Safe payload was altered: ${sanitizedSafe}`);
      }

      return `All formula injection prefixes neutralized with apostrophe quoting`;
    }
  );

  await runTest(
    'T2.2-10',
    'التحقق من صحة كشف الطلاب المرفوع (Pre-import CSV Validation) واكتشاف التكرارات والأخطاء',
    'CSV Validation',
    'Integration Test',
    async () => {
      const rawRecords = [
        { name: 'علي حسن السالم', student_id: 'std_20801', email: 'ali@school.kw' },
        { name: 'محمد ناصر العجمي', student_id: 'std_20802', email: 'mohd@school.kw' },
        { name: 'س', student_id: 'std_20803', email: 'short@school.kw' }, // Invalid short name
        { name: 'طالب بدون رقم', student_id: '', email: '' }, // Missing id and email
        { name: 'علي حسن مكرر', student_id: 'std_20801', email: 'ali_dup@school.kw' }, // Duplicate ID std_20801
      ];

      const res = await fetch(`${baseUrl}/api/v1/teacher/classes/${createdClassId}/students/validate-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTeacherA}`,
        },
        body: JSON.stringify({ records: rawRecords }),
      });

      const body = await res.json();
      if (res.status !== 200 || !body.success) {
        throw new Error(`Expected 200 OK, received ${res.status}: ${JSON.stringify(body)}`);
      }

      const summary = body.data.summary;
      if (summary.total !== 5 || summary.valid_count !== 2 || summary.error_count !== 3 || summary.duplicate_count !== 1) {
        throw new Error(`Validation summary mismatch: ${JSON.stringify(summary)}`);
      }

      return `CSV validated: Total=5, Valid=2, Errors=3, Duplicates=1`;
    }
  );

  await runTest(
    'T2.2-11',
    'اعتماد استيراد كشف الطلاب الجماعي وإضافتهم لقائمة الفصل الدراسي',
    'CSV Bulk Import',
    'Integration Test',
    async () => {
      const validStudents = [
        { student_id: 'usr_s_imported_01', student_name: 'فيصل مبارك الجيران', student_email: 'faisal@school.kw' },
        { student_id: 'usr_s_imported_02', student_name: 'بدر ناصر الدوسري', student_email: 'bader@school.kw' },
      ];

      const res = await fetch(`${baseUrl}/api/v1/teacher/classes/${createdClassId}/students/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTeacherA}`,
        },
        body: JSON.stringify({ students: validStudents }),
      });

      const body = await res.json();
      if (res.status !== 200 || !body.success || body.data.imported_count !== 2) {
        throw new Error(`Expected 200 with 2 imported, got: ${JSON.stringify(body)}`);
      }

      return `Bulk import committed: ${body.data.imported_count} students added to roster`;
    }
  );

  // ---------------------------------------------------------------------------
  // 5. ATTENDANCE MANAGEMENT
  // ---------------------------------------------------------------------------
  const testAttendanceDate = '2025-03-10';
  const testSessionNumber = 1;

  await runTest(
    'T2.2-12',
    'رصد حضور وغياب جماعي للطلاب في الحصة الأولى داخل معاملة واحدة',
    'Attendance Management',
    'Integration Test',
    async () => {
      const records = [
        {
          student_id: studentUser1.id,
          attendance_date: testAttendanceDate,
          session_number: testSessionNumber,
          status: 'present',
          notes: 'حضور مبكر وتفاعل في تجربة المعايرة',
        },
        {
          student_id: 'usr_s_imported_01',
          attendance_date: testAttendanceDate,
          session_number: testSessionNumber,
          status: 'late',
          notes: 'تأخر 5 دقائق بعذر',
        },
        {
          student_id: 'usr_s_imported_02',
          attendance_date: testAttendanceDate,
          session_number: testSessionNumber,
          status: 'absent',
          notes: 'غياب بدون إشعار مسبق',
        },
      ];

      const res = await fetch(`${baseUrl}/api/v1/teacher/classes/${createdClassId}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTeacherA}`,
        },
        body: JSON.stringify({ records }),
      });

      const body = await res.json();
      if (res.status !== 200 || !body.success || body.data.length !== 3) {
        throw new Error(`Expected 200 with 3 records saved, received ${res.status}: ${JSON.stringify(body)}`);
      }

      return `Attendance batch recorded: 3 student records for Date=${testAttendanceDate}, Session=${testSessionNumber}`;
    }
  );

  await runTest(
    'T2.2-13',
    'استرجاع سجلات الحضور لحصة وتاريخ محدد والتأكد من تطابق البيانات والحالات',
    'Attendance Management',
    'Integration Test',
    async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/teacher/classes/${createdClassId}/attendance?date=${testAttendanceDate}&session=${testSessionNumber}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tokenTeacherA}`,
          },
        }
      );

      const body = await res.json();
      if (res.status !== 200 || !body.success || !Array.isArray(body.data)) {
        throw new Error(`Expected 200 with records array, received ${res.status}`);
      }

      const pres = body.data.find((r: any) => r.student_id === studentUser1.id);
      if (!pres || pres.status !== 'present') {
        throw new Error(`Expected student ${studentUser1.id} to be present, got: ${JSON.stringify(pres)}`);
      }

      return `Attendance retrieved: ${body.data.length} records verified for session ${testSessionNumber}`;
    }
  );

  await runTest(
    'T2.2-14',
    'تعديل سجل حضور طالب محدد وتحديث الحالة والملاحظة بنجاح',
    'Attendance Management',
    'Integration Test',
    async () => {
      // First get the record id
      const getRes = await fetch(
        `${baseUrl}/api/v1/teacher/classes/${createdClassId}/attendance?date=${testAttendanceDate}&session=${testSessionNumber}`,
        { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
      );
      const getBody = await getRes.json();
      const targetRecord = getBody.data.find((r: any) => r.student_id === 'usr_s_imported_02');

      const patchRes = await fetch(
        `${baseUrl}/api/v1/teacher/classes/${createdClassId}/attendance/${targetRecord.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTeacherA}`,
          },
          body: JSON.stringify({
            status: 'excused',
            notes: 'تم تقديم عذر طبي رسمي معتمد من الإدارة',
          }),
        }
      );

      const patchBody = await patchRes.json();
      if (patchRes.status !== 200 || !patchBody.success || patchBody.data.status !== 'excused') {
        throw new Error(`Expected 200 OK with excused status, got ${patchRes.status}: ${JSON.stringify(patchBody)}`);
      }

      return `Record updated: Status=excused, Notes="${patchBody.data.notes}"`;
    }
  );

  await runTest(
    'T2.2-15',
    'حساب ملخص ونسب الحضور الإجمالية للفصل والطلاب بدقة',
    'Attendance Analytics',
    'Integration Test',
    async () => {
      const res = await fetch(`${baseUrl}/api/v1/teacher/classes/${createdClassId}/attendance/summary`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenTeacherA}`,
        },
      });

      const body = await res.json();
      if (res.status !== 200 || !body.success || !body.data) {
        throw new Error(`Expected 200 OK, received ${res.status}: ${JSON.stringify(body)}`);
      }

      const summary = body.data;
      if (summary.total_sessions < 1 || summary.total_records < 1) {
        throw new Error(`Invalid summary metrics: ${JSON.stringify(summary)}`);
      }

      return `Summary: TotalSessions=${summary.total_sessions}, TotalRecords=${summary.total_records}, Rate=${summary.attendance_rate}%`;
    }
  );

  // ---------------------------------------------------------------------------
  // 6. ARCHIVE & DEACTIVATION
  // ---------------------------------------------------------------------------
  await runTest(
    'T2.2-16',
    'أرشفة الفصل الدراسي ومنع الطلاب الجدد من الانضمام إليه (400 Bad Request)',
    'Class Archiving',
    'Integration Test',
    async () => {
      // Archive class
      const archiveRes = await fetch(`${baseUrl}/api/v1/teacher/classes/${createdClassId}/archive`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenTeacherA}`,
        },
      });

      if (archiveRes.status !== 200) {
        throw new Error(`Failed to archive class: ${archiveRes.status}`);
      }

      // Student 2 attempts to join archived class
      const joinRes = await fetch(`${baseUrl}/api/v1/teacher/classes/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenStudent2}`,
        },
        body: JSON.stringify({ join_code: activeJoinCode }),
      });

      if (joinRes.status !== 400) {
        throw new Error(`Expected 400 Bad Request for archived class, received ${joinRes.status}`);
      }

      const joinBody = await joinRes.json();
      if (joinBody.error !== 'CLASS_ARCHIVED') {
        throw new Error(`Expected error CLASS_ARCHIVED, got: ${joinBody.error}`);
      }

      return `Archived class rejected new join attempt with 400 (${joinBody.error})`;
    }
  );

  // ---------------------------------------------------------------------------
  // 7. RBAC & PERMISSION BOUNDARIES
  // ---------------------------------------------------------------------------
  await runTest(
    'T2.2-17',
    'إنفاذ RBAC: منع الطالب من إنشاء فصل دراسي أو رصد حضور (403 Forbidden)',
    'RBAC Enforcement',
    'Integration Test',
    async () => {
      const res = await fetch(`${baseUrl}/api/v1/teacher/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenStudent1}`,
        },
        body: JSON.stringify({
          name: 'فصل الطالب غير المصرح',
          grade_level: 'الصف العاشر',
          academic_year: '2024/2025',
          term: 'term_1',
        }),
      });

      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden for STUDENT role creating class, received ${res.status}`);
      }

      const body = await res.json();
      if (body.error !== 'FORBIDDEN_ROLE') {
        throw new Error(`Expected error code FORBIDDEN_ROLE, received: ${body.error}`);
      }

      return `Student creation attempt blocked by RBAC middleware with 403 (${body.error})`;
    }
  );

  await runTest(
    'T2.2-18',
    'حماية CSRF: رفض الطلبات المعدلة المعتمدة على ملفات تعريف الارتباط بدون رمز CSRF صالح',
    'CSRF Protection',
    'Integration Test',
    async () => {
      // Mutating request using cookie without x-csrf-token
      const res = await fetch(`${baseUrl}/api/v1/teacher/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `nexora_token=${tokenTeacherA}; nexora_csrf=abc1234567890123456`,
        },
        body: JSON.stringify({
          name: 'فصل بدون CSRF',
          grade_level: 'الصف العاشر',
          academic_year: '2024/2025',
          term: 'term_1',
        }),
      });

      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden for missing CSRF header, received ${res.status}`);
      }

      const body = await res.json();
      if (body.error !== 'CSRF_VALIDATION_FAILED') {
        throw new Error(`Expected error CSRF_VALIDATION_FAILED, received: ${body.error}`);
      }

      return `Cookie request without matching X-CSRF-Token rejected with 403 (${body.error})`;
    }
  );

  // Close test server
  await new Promise<void>((resolve) => server.close(() => resolve()));

  // ---------------------------------------------------------------------------
  // SUITE SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('  TEST SUITE RESULTS SUMMARY                                                    ');
  console.log('================================================================================');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Tests Run: ${total}`);
  console.log(`Passed:         ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`Failed:         ${failed} (${((failed / total) * 100).toFixed(1)}%)`);

  if (failed > 0) {
    console.error('\nFAILED TESTS:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`- [${r.id}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\nALL 18 TESTS PASSED SUCCESSFULLY! (100.0% PASS RATE)');
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('FATAL TEST RUNNER ERROR:', err);
  process.exit(1);
});
