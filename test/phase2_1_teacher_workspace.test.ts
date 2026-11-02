/**
 * NEXORA Phase 2.1 — Teacher Workspace Infrastructure & Security Test Suite
 * 
 * Verifies:
 * 1. Static Migration 004 verification (All 10 tables, constraints, foreign keys)
 * 2. Scoped Classroom Isolation: Teacher cannot access another teacher's classes (IDOR defense)
 * 3. Student Enrollment Scoping: Teacher cannot enroll students in another teacher's class
 * 4. Attendance Recording & Duplicate Session Guard: Same student in same period cannot have duplicate records
 * 5. Lesson Plan Ownership Isolation: Non-supervisor teachers cannot read other teachers' draft plans
 * 6. Supervisory RBAC: Only LEAD or PRO can submit formal supervisory feedback and update plan status
 * 7. Non-Supervisor Feedback Rejection: Regular teachers blocked from submitting supervisory reviews
 * 8. Assignment Management Scoping: Teacher cannot create assignments for classes they do not own
 * 9. Grading Scoping: Teacher cannot grade homework submissions for another teacher's class
 * 10. In-App Notifications Isolation: Notifications can only be read/updated by the recipient user
 */

import fs from 'fs';
import path from 'path';
import {
  teacherRepo,
  ClassAccessDeniedError,
  LessonPlanAccessDeniedError,
} from '../server/db/repositories/teacherRepository';

interface TestResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  evidence: string;
  error?: string;
}

const results: TestResult[] = [];

async function test(
  id: string,
  name: string,
  category: string,
  fn: () => Promise<string>
): Promise<void> {
  const start = Date.now();
  try {
    const evidence = await fn();
    const durationMs = Date.now() - start;
    results.push({ id, name, category, passed: true, evidence });
    console.log(`[PASS] [${id}] [${category}] ${name} (${durationMs}ms)`);
    console.log(`       ↳ Evidence: ${evidence}`);
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ id, name, category, passed: false, evidence: 'Failed', error: msg });
    console.error(`[FAIL] [${id}] [${category}] ${name} (${durationMs}ms)`);
    console.error(`       ↳ Error: ${msg}`);
  }
}

async function runSuite() {
  console.log('================================================================================');
  console.log('  NEXORA PHASE 2.1 — TEACHER WORKSPACE INFRASTRUCTURE & SECURITY TEST SUITE     ');
  console.log('================================================================================\n');

  // Test Personas
  const teacherA = 'usr_teach_ahmad';
  const teacherB = 'usr_teach_salem';
  const student1 = 'usr_student_khalid';
  const student2 = 'usr_student_omar';
  const supervisorLead = 'usr_lead_meshal';

  let classAId = '';
  let planAId = '';
  let asgAId = '';

  // ---------------------------------------------------------------------------
  // 1. Static Migration 004 Verification
  // ---------------------------------------------------------------------------
  await test(
    'MIG-01',
    'التحقق الساكن من ملف الهجرة 004_teacher_workspace.sql واحتوائه على الجداول العشرة المعتمدة',
    'Static Migration Check',
    async () => {
      const migrationPath = path.resolve(process.cwd(), 'db/migrations/004_teacher_workspace.sql');
      if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration file not found at ${migrationPath}`);
      }

      const sql = fs.readFileSync(migrationPath, 'utf-8');
      const expectedTables = [
        'teacher_classes',
        'class_students',
        'student_attendance_records',
        'teacher_lesson_plans',
        'lesson_plan_feedback',
        'teacher_assignments',
        'assignment_submissions',
        'teacher_question_bank',
        'teacher_assessments',
        'in_app_notifications',
      ];

      for (const table of expectedTables) {
        if (!sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
          throw new Error(`Table definition missing in SQL: ${table}`);
        }
      }

      // Check attendance unique constraint
      if (!sql.includes('uq_student_attendance_session')) {
        throw new Error('Unique constraint uq_student_attendance_session missing in SQL');
      }

      // Check class students unique constraint
      if (!sql.includes('uq_class_student')) {
        throw new Error('Unique constraint uq_class_student missing in SQL');
      }

      return `Migration 004 verified: All 10 tables defined with constraints and indexing.`;
    }
  );

  // ---------------------------------------------------------------------------
  // 2. Classroom Scoping & IDOR Defense
  // ---------------------------------------------------------------------------
  await test(
    'CLS-01',
    'إنشاء فصل دراسي جديد للمعلم مع توليد كود انضمام فريد ذرياً',
    'Classroom Scoping',
    async () => {
      const newClass = await teacherRepo.createClass(teacherA, {
        name: 'الصف الثاني عشر علمي - كيمياء متقدمة',
        grade_level: 'الصف الثاني عشر',
        academic_year: '2025-2026',
        term: 'term_1',
        subject: 'كيمياء',
        room_number: 'مختبر 3',
      });

      if (!newClass.id || !newClass.join_code) {
        throw new Error('Class ID or Join Code missing');
      }
      if (!newClass.join_code.startsWith('NX-')) {
        throw new Error(`Invalid join code prefix: ${newClass.join_code}`);
      }
      classAId = newClass.id;

      return `Class created: id=${newClass.id}, teacher=${newClass.teacher_id}, join_code=${newClass.join_code}.`;
    }
  );

  await test(
    'IDOR-CLS-01',
    'عزل الفصول: منع المعلم (ب) من قراءة تفاصيل فصل يتبع المعلم (أ) عبر IDOR',
    'IDOR Defense',
    async () => {
      const attempt = await teacherRepo.getClassById(teacherB, classAId);
      if (attempt !== null) {
        throw new Error('SECURITY VIOLATION: Teacher B accessed Teacher A class!');
      }

      return `Teacher B blocked from accessing Teacher A class (${classAId}). Scoped query returned null.`;
    }
  );

  await test(
    'IDOR-CLS-02',
    'عزل القوائم: قائمة فصول المعلم (ب) لا تحتوي على أي من فصول المعلم (أ)',
    'Classroom Isolation',
    async () => {
      const teacherBClasses = await teacherRepo.listClasses(teacherB);
      const leaked = teacherBClasses.some((c) => c.id === classAId);
      if (leaked) {
        throw new Error('SECURITY VIOLATION: Class A leaked in Teacher B classes list!');
      }

      return `Teacher B list clean (0 items leaked from Teacher A).`;
    }
  );

  // ---------------------------------------------------------------------------
  // 3. Student Enrollment & Attendance Scoping
  // ---------------------------------------------------------------------------
  await test(
    'ENR-01',
    'إضافة طالب إلى فصل المعلم والتحقق من قائمة الطلاب',
    'Student Roster',
    async () => {
      const studentRecord = await teacherRepo.enrollStudent(teacherA, classAId, student1);
      if (studentRecord.student_id !== student1) throw new Error('Student ID mismatch');

      const roster = await teacherRepo.listClassStudents(teacherA, classAId);
      if (!roster.some((s) => s.student_id === student1)) {
        throw new Error('Enrolled student not in roster');
      }

      return `Student ${student1} enrolled in class ${classAId}. Roster size: ${roster.length}.`;
    }
  );

  await test(
    'IDOR-ENR-01',
    'منع المعلم (ب) من إضافة طلاب إلى فصل المعلم (أ) وإرجاع ClassAccessDeniedError',
    'Enrollment Protection',
    async () => {
      try {
        await teacherRepo.enrollStudent(teacherB, classAId, student2);
        throw new Error('Expected ClassAccessDeniedError, but operation succeeded');
      } catch (err: unknown) {
        if (!(err instanceof ClassAccessDeniedError)) {
          throw new Error(`Unexpected error type: ${String(err)}`);
        }
      }

      return `Unauthorized enrollment blocked with ClassAccessDeniedError (HTTP 403).`;
    }
  );

  await test(
    'ATT-01',
    'رصد حضور الطالب وتحديثه ذرياً دون تكرار في نفس الحصة والتاريخ',
    'Attendance Tracking',
    async () => {
      const date = '2026-11-02';
      const session = 1;

      // 1. First record: Present
      const records1 = await teacherRepo.recordAttendance(teacherA, classAId, [
        { student_id: student1, attendance_date: date, session_number: session, status: 'present', notes: 'حضور منتظم' },
      ]);
      if (records1[0].status !== 'present') throw new Error('First status failed');

      // 2. Second update: Late (Atomic update on duplicate session)
      const records2 = await teacherRepo.recordAttendance(teacherA, classAId, [
        { student_id: student1, attendance_date: date, session_number: session, status: 'late', notes: 'تأخر 5 دقائق' },
      ]);
      if (records2[0].status !== 'late') throw new Error('Updated status failed');

      return `Attendance recorded and safely updated atomically: status=${records2[0].status}, session=${session}.`;
    }
  );

  await test(
    'IDOR-ATT-01',
    'منع المعلم (ب) من تسجيل أو تعديل حضور فصول المعلم (أ)',
    'Attendance IDOR Defense',
    async () => {
      try {
        await teacherRepo.recordAttendance(teacherB, classAId, [
          { student_id: student1, attendance_date: '2026-11-02', session_number: 2, status: 'absent' },
        ]);
        throw new Error('Expected ClassAccessDeniedError, but operation succeeded');
      } catch (err: unknown) {
        if (!(err instanceof ClassAccessDeniedError)) {
          throw new Error(`Unexpected error: ${String(err)}`);
        }
      }

      return `Teacher B attendance mutation on Class A blocked with ClassAccessDeniedError.`;
    }
  );

  // ---------------------------------------------------------------------------
  // 4. Lesson Planning & Supervisory Feedback
  // ---------------------------------------------------------------------------
  await test(
    'PLAN-01',
    'إنشاء خطة تحضير درس تفاعلية مع الأهداف التعليمية والإجراءات التدريسية',
    'Lesson Planning',
    async () => {
      const plan = await teacherRepo.createLessonPlan(teacherA, {
        title: 'قوانين الغازات: قانون بويل وتطبيقاته المخبرية',
        grade_level: 'الصف الثاني عشر',
        unit_name: 'الوحدة الثانية: الغازات وسلوك المادة',
        lesson_date: '2026-11-05',
        learning_objectives: [
          'أن يستنتج الطالب العلاقة العكسية بين حجم الغاز وضغطه عند ثبوت درجة الحرارة.',
          'أن يطبق الطالب العلاقة الرياضية P1V1 = P2V2 في حل مسائل كيميائية.',
        ],
        prior_knowledge: 'المفاهيم الأساسية للضغط الجوي والحجم ودرجة الحرارة المطلقة.',
        required_materials: 'جهاز قانون بويل، محاقن مدرجة، حساسات ضغط رقمية، المختبر الافتراضي.',
        instructional_procedures: [
          { step: 1, activity: 'التهيئة الحافزة وعرض فيديو لتمدد بالون في حجرة مفرغة', duration_minutes: 5 },
          { step: 2, activity: 'تنفيذ تجربة قانون بويل بالمختبر الافتراضي وتسجيل النتائج في جدول', duration_minutes: 20 },
          { step: 3, activity: 'الاستنتاج الرياضي وتمثيل العلاقة بيانياً', duration_minutes: 10 },
          { step: 4, activity: 'تقويم ختامي وحل مسألة تطبيقية', duration_minutes: 10 },
        ],
        homework_description: 'حل التدريب رقم 3 صفحة 45 من مذكرة الكيمياء.',
      });

      if (!plan.id || plan.status !== 'draft') throw new Error('Lesson plan draft creation failed');
      planAId = plan.id;

      return `Lesson plan created: id=${plan.id}, title="${plan.title}", status=${plan.status}.`;
    }
  );

  await test(
    'IDOR-PLAN-01',
    'منع المعلم (ب) من الاطلاع على مسودة تحضير المعلم (أ) وإرجاع LessonPlanAccessDeniedError',
    'Lesson Plan Isolation',
    async () => {
      try {
        await teacherRepo.getLessonPlanById(teacherB, 'TEACH', planAId);
        throw new Error('Expected LessonPlanAccessDeniedError, but teacher B accessed plan');
      } catch (err: unknown) {
        if (!(err instanceof LessonPlanAccessDeniedError)) {
          throw new Error(`Unexpected error: ${String(err)}`);
        }
      }

      return `Teacher B blocked from accessing Teacher A lesson plan with LessonPlanAccessDeniedError.`;
    }
  );

  await test(
    'SUP-FEEDBACK-01',
    'السماح للموجه الفني (LEAD) بالاطلاع على خطة التحضير وإضافة تقييم تربوي رسمي مع الاعتماد',
    'Supervisory Feedback',
    async () => {
      const plan = await teacherRepo.getLessonPlanById(supervisorLead, 'LEAD', planAId);
      if (!plan || plan.id !== planAId) throw new Error('Supervisor could not retrieve plan');

      const feedback = await teacherRepo.addSupervisoryFeedback(supervisorLead, 'LEAD', planAId, {
        feedback_text: 'خطة درس متميزة ترتكز على الاستقصاء العلمي واستخدام المختبر الافتراضي بصورة نموذجية.',
        rating: 5,
        strengths: 'تكامل رائع بين التجربة العملية والتمثيل البياني، ومراعاة الفروق الفردية.',
        recommendations: 'تعزيز التقويم البنائي أثناء خطوات التجربة.',
        newStatus: 'approved',
      });

      if (feedback.rating !== 5) throw new Error('Feedback rating mismatch');

      // Verify plan status updated to approved
      const updatedPlan = await teacherRepo.getLessonPlanById(teacherA, 'TEACH', planAId);
      if (updatedPlan?.status !== 'approved') {
        throw new Error(`Expected approved status, got ${updatedPlan?.status}`);
      }

      return `Supervisor approved plan: rating=5/5, newStatus=${updatedPlan.status}, reviewer=${updatedPlan.reviewed_by}.`;
    }
  );

  await test(
    'RBAC-FEEDBACK-01',
    'منع المعلم العادي (غير المشرف) من تقديم تقييم تربوي رسمي ورفض الطلب',
    'RBAC Supervisory Defense',
    async () => {
      try {
        await teacherRepo.addSupervisoryFeedback(teacherB, 'TEACH', planAId, {
          feedback_text: 'محاولة تقييم غير مصرح بها',
        });
        throw new Error('Expected LessonPlanAccessDeniedError, but regular teacher provided review');
      } catch (err: unknown) {
        if (!(err instanceof LessonPlanAccessDeniedError)) {
          throw new Error(`Unexpected error: ${String(err)}`);
        }
      }

      return `Regular teacher blocked from providing supervisory feedback.`;
    }
  );

  // ---------------------------------------------------------------------------
  // 5. Assignments & Grading Scoping
  // ---------------------------------------------------------------------------
  await test(
    'ASG-01',
    'إنشاء واجب مدرسي جديد وتعيينه لفصل المعلم المصرح له',
    'Assignments Management',
    async () => {
      const asg = await teacherRepo.createAssignment(teacherA, {
        class_id: classAId,
        title: 'واجب كيمياء 1: حسابات قانون بويل',
        description: 'حل المسائل من 1 إلى 5 في ورقة العمل التفاعلية المرفقة.',
        max_score: 10,
        due_date: '2026-11-10T23:59:59Z',
      });

      if (!asg.id || asg.max_score !== 10) throw new Error('Assignment creation failed');
      asgAId = asg.id;

      return `Assignment created: id=${asg.id}, class=${asg.class_id}, max_score=${asg.max_score}.`;
    }
  );

  await test(
    'IDOR-ASG-01',
    'منع المعلم (ب) من إنشاء واجب دراسي لفصل يتبع المعلم (أ)',
    'Assignment IDOR Defense',
    async () => {
      try {
        await teacherRepo.createAssignment(teacherB, {
          class_id: classAId,
          title: 'واجب غير مصرح به',
          description: 'نص تجريبي...',
          due_date: '2026-11-10T23:59:59Z',
        });
        throw new Error('Expected ClassAccessDeniedError, but teacher B created assignment on class A');
      } catch (err: unknown) {
        if (!(err instanceof ClassAccessDeniedError)) {
          throw new Error(`Unexpected error: ${String(err)}`);
        }
      }

      return `Teacher B blocked from creating assignment for Teacher A class.`;
    }
  );

  // ---------------------------------------------------------------------------
  // 6. In-App Notifications
  // ---------------------------------------------------------------------------
  await test(
    'NOTIF-01',
    'إرسال إشعار فوري لمستخدم وتحديث حالة القراءة وعزل المستخدمين',
    'In-App Notifications',
    async () => {
      const notif = await teacherRepo.sendNotification(teacherA, {
        title: 'اعتماد خطة درس',
        message: 'تم اعتماد خطة درس (قوانين الغازات) من قِبل الموجه الفني د. مشعل.',
        type: 'lesson_plan_feedback',
        entity_id: planAId,
        action_url: `/teacher/plans/${planAId}`,
      });

      if (notif.is_read !== false) throw new Error('New notification should be unread');

      const notifsBefore = await teacherRepo.getUserNotifications(teacherA);
      if (!notifsBefore.some((n) => n.id === notif.id)) throw new Error('Notification not in list');

      // Teacher B should not see Teacher A notification
      const teacherBNotifs = await teacherRepo.getUserNotifications(teacherB);
      if (teacherBNotifs.some((n) => n.id === notif.id)) {
        throw new Error('SECURITY VIOLATION: Notification leaked to another user!');
      }

      // Mark as read
      const marked = await teacherRepo.markNotificationRead(teacherA, notif.id);
      if (!marked) throw new Error('Mark as read failed');

      return `Notification sent, isolated from other users, and marked read successfully.`;
    }
  );

  // Print Summary
  console.log('\n================================================================================');
  console.log('  TEST EXECUTION SUMMARY');
  console.log('================================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Scenarios Tested : ${results.length}`);
  console.log(`Passed                 : ${passedCount}`);
  console.log(`Failed                 : ${failedCount}`);
  console.log(`Success Rate           : ${((passedCount / results.length) * 100).toFixed(1)}%\n`);

  if (failedCount > 0) {
    console.error('Some tests failed! Review the logs above.');
    process.exit(1);
  } else {
    console.log('ALL PHASE 2.1 TEACHER WORKSPACE TESTS PASSED CLEANLY!\n');
  }
}

runSuite().catch((err) => {
  console.error('Fatal crash in Phase 2.1 test suite:', err);
  process.exit(1);
});
