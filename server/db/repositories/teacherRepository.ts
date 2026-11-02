import crypto from 'crypto';
import { query, isValidPostgresUrl } from '../postgres';

// ============================================================================
// 1. DATA MODELS & TYPES
// ============================================================================

export interface TeacherClass {
  id: string;
  teacher_id: string;
  name: string;
  subject: string;
  grade_level: string;
  academic_year: string;
  term: 'term_1' | 'term_2' | 'summer';
  join_code: string;
  room_number?: string | null;
  status: 'active' | 'archived' | 'completed';
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassStudent {
  id: string;
  class_id: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  status: 'active' | 'dropped' | 'transferred' | 'suspended';
  joined_at: string;
  updated_at: string;
}

export interface StudentAttendanceRecord {
  id: string;
  class_id: string;
  student_id: string;
  attendance_date: string;
  session_number: number;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeacherLessonPlan {
  id: string;
  teacher_id: string;
  title: string;
  subject: string;
  grade_level: string;
  unit_name: string;
  lesson_date?: string | null;
  learning_objectives: string[];
  prior_knowledge?: string | null;
  required_materials?: string | null;
  instructional_procedures: Array<{ step: number; activity: string; duration_minutes: number }>;
  assessment_strategies?: string | null;
  homework_description?: string | null;
  differentiation_notes?: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'archived';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonPlanFeedback {
  id: string;
  plan_id: string;
  supervisor_id: string;
  supervisor_name?: string;
  feedback_text: string;
  rating?: number | null;
  strengths?: string | null;
  recommendations?: string | null;
  created_at: string;
}

export interface TeacherAssignment {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description: string;
  attachment_url?: string | null;
  max_score: number;
  due_date: string;
  status: 'draft' | 'published' | 'closed' | 'archived';
  allow_late_submission: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  submission_text?: string | null;
  file_url?: string | null;
  score?: number | null;
  feedback?: string | null;
  status: 'pending' | 'submitted' | 'graded' | 'late' | 'resubmitted';
  submitted_at: string;
  graded_at?: string | null;
  graded_by?: string | null;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'attendance' | 'assignment' | 'lesson_plan_feedback' | 'assessment' | 'system';
  entity_id?: string | null;
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

// Custom Domain Errors
export class ClassAccessDeniedError extends Error {
  public statusCode = 403;
  constructor(message = 'FORBIDDEN_CLASS_ACCESS: ليس لديك صلاحية الوصول إلى بيانات هذا الفصل') {
    super(message);
    this.name = 'ClassAccessDeniedError';
  }
}

export class ClassNotFoundError extends Error {
  public statusCode = 404;
  constructor(message = 'CLASS_NOT_FOUND: الفصل الدراسي المطلوب غير موجود') {
    super(message);
    this.name = 'ClassNotFoundError';
  }
}

export class InvalidJoinCodeError extends Error {
  public statusCode = 404;
  constructor(message = 'INVALID_JOIN_CODE: رمز الانضمام غير صالح أو منتهي الصلاحية') {
    super(message);
    this.name = 'InvalidJoinCodeError';
  }
}

export class ClassArchivedError extends Error {
  public statusCode = 400;
  constructor(message = 'CLASS_ARCHIVED: لا يمكن الانضمام أو التعديل على فصل دراسي مؤرشف أو مغلق') {
    super(message);
    this.name = 'ClassArchivedError';
  }
}

export class StudentAlreadyEnrolledError extends Error {
  public statusCode = 409;
  constructor(message = 'STUDENT_ALREADY_ENROLLED: الطالب منضم مسبقاً إلى هذا الفصل الدراسي') {
    super(message);
    this.name = 'StudentAlreadyEnrolledError';
  }
}

export class DuplicateAttendanceError extends Error {
  public statusCode = 409;
  constructor(message = 'DUPLICATE_ATTENDANCE: تم تسجيل حضور هذا الطالب مسبقاً في نفس الحصة والتاريخ') {
    super(message);
    this.name = 'DuplicateAttendanceError';
  }
}

export class LessonPlanAccessDeniedError extends Error {
  public statusCode = 403;
  constructor(message = 'FORBIDDEN_PLAN_ACCESS: ليس لديك صلاحية الاطلاع أو التعديل على خطة التحضير هذه') {
    super(message);
    this.name = 'LessonPlanAccessDeniedError';
  }
}

/**
 * Sanitizes spreadsheet inputs against CSV / Formula Injection attacks (CWE-1236)
 */
export function sanitizeCsvFormula(value: string | undefined | null): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  // Strip or neutralize leading characters that trigger formula execution in Excel/Sheets
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}


// ============================================================================
// 2. TEACHER REPOSITORY IMPLEMENTATION
// ============================================================================

export class TeacherRepository {
  // In-Memory store for isolated sandbox/unit test execution
  private memClasses: Map<string, TeacherClass> = new Map();
  private memStudents: Map<string, ClassStudent> = new Map();
  private memAttendance: Map<string, StudentAttendanceRecord> = new Map();
  private memPlans: Map<string, TeacherLessonPlan> = new Map();
  private memFeedback: Map<string, LessonPlanFeedback> = new Map();
  private memAssignments: Map<string, TeacherAssignment> = new Map();
  private memSubmissions: Map<string, AssignmentSubmission> = new Map();
  private memNotifications: Map<string, InAppNotification> = new Map();

  private isPostgres(): boolean {
    return isValidPostgresUrl(process.env.DATABASE_URL);
  }

  // --------------------------------------------------------------------------
  // A. CLASSROOM MANAGEMENT (Scoped by teacher_id)
  // --------------------------------------------------------------------------

  public async createClass(
    teacherId: string,
    data: {
      name: string;
      grade_level: string;
      academic_year: string;
      term: 'term_1' | 'term_2' | 'summer';
      subject?: string;
      room_number?: string;
    }
  ): Promise<TeacherClass> {
    const id = `cls_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const joinCode = `NX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();

    const entity: TeacherClass = {
      id,
      teacher_id: teacherId,
      name: data.name.trim(),
      subject: data.subject || 'كيمياء',
      grade_level: data.grade_level,
      academic_year: data.academic_year,
      term: data.term,
      join_code: joinCode,
      room_number: data.room_number || null,
      status: 'active',
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };

    if (this.isPostgres()) {
      const sql = `
        INSERT INTO teacher_classes (
          id, teacher_id, name, subject, grade_level, academic_year, term, join_code, room_number, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
      `;
      const res = await query<TeacherClass>(sql, [
        entity.id, entity.teacher_id, entity.name, entity.subject, entity.grade_level,
        entity.academic_year, entity.term, entity.join_code, entity.room_number, entity.status,
        entity.created_at, entity.updated_at,
      ]);
      return res.rows[0];
    }

    this.memClasses.set(id, entity);
    return { ...entity };
  }

  public async listClasses(
    teacherId: string,
    options: { status?: 'active' | 'archived' | 'completed' } = {}
  ): Promise<TeacherClass[]> {
    const status = options.status || 'active';

    if (this.isPostgres()) {
      const sql = `
        SELECT * FROM teacher_classes
        WHERE teacher_id = $1 AND status = $2 AND deleted_at IS NULL
        ORDER BY created_at DESC;
      `;
      const res = await query<TeacherClass>(sql, [teacherId, status]);
      return res.rows;
    }

    return Array.from(this.memClasses.values())
      .filter((c) => c.teacher_id === teacherId && c.status === status && !c.deleted_at)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public async getClassById(teacherId: string, classId: string): Promise<TeacherClass | null> {
    if (this.isPostgres()) {
      const sql = `
        SELECT * FROM teacher_classes
        WHERE id = $1 AND teacher_id = $2 AND deleted_at IS NULL
        LIMIT 1;
      `;
      const res = await query<TeacherClass>(sql, [classId, teacherId]);
      return res.rows[0] || null;
    }

    const c = this.memClasses.get(classId);
    if (!c || c.deleted_at || c.teacher_id !== teacherId) {
      return null;
    }
    return { ...c };
  }

  public async updateClass(
    teacherId: string,
    classId: string,
    data: {
      name?: string;
      grade_level?: string;
      academic_year?: string;
      term?: 'term_1' | 'term_2' | 'summer';
      subject?: string;
      room_number?: string | null;
      status?: 'active' | 'archived' | 'completed';
    }
  ): Promise<TeacherClass> {
    const targetClass = await this.getClassById(teacherId, classId);
    if (!targetClass) {
      throw new ClassAccessDeniedError();
    }
    if (targetClass.status === 'archived' && data.status !== 'active') {
      throw new ClassArchivedError();
    }

    const now = new Date().toISOString();
    const updated: TeacherClass = {
      ...targetClass,
      name: data.name !== undefined ? data.name.trim() : targetClass.name,
      grade_level: data.grade_level !== undefined ? data.grade_level : targetClass.grade_level,
      academic_year: data.academic_year !== undefined ? data.academic_year : targetClass.academic_year,
      term: data.term !== undefined ? data.term : targetClass.term,
      subject: data.subject !== undefined ? data.subject : targetClass.subject,
      room_number: data.room_number !== undefined ? data.room_number : targetClass.room_number,
      status: data.status !== undefined ? data.status : targetClass.status,
      updated_at: now,
    };

    if (this.isPostgres()) {
      const sql = `
        UPDATE teacher_classes
        SET name = $1, grade_level = $2, academic_year = $3, term = $4, subject = $5, room_number = $6, status = $7, updated_at = $8
        WHERE id = $9 AND teacher_id = $10 AND deleted_at IS NULL
        RETURNING *;
      `;
      const res = await query<TeacherClass>(sql, [
        updated.name, updated.grade_level, updated.academic_year, updated.term,
        updated.subject, updated.room_number, updated.status, updated.updated_at,
        classId, teacherId,
      ]);
      return res.rows[0];
    }

    this.memClasses.set(classId, updated);
    return { ...updated };
  }

  public async archiveClass(teacherId: string, classId: string): Promise<TeacherClass> {
    return this.updateClass(teacherId, classId, { status: 'archived' });
  }

  public async regenerateJoinCode(teacherId: string, classId: string): Promise<{ join_code: string }> {
    const targetClass = await this.getClassById(teacherId, classId);
    if (!targetClass) {
      throw new ClassAccessDeniedError();
    }
    if (targetClass.status === 'archived') {
      throw new ClassArchivedError('CLASS_ARCHIVED: لا يمكن إعادة توليد رمز لفصل مؤرشف');
    }

    const newCode = `NX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();

    if (this.isPostgres()) {
      const sql = `
        UPDATE teacher_classes
        SET join_code = $1, updated_at = $2
        WHERE id = $3 AND teacher_id = $4
        RETURNING join_code;
      `;
      const res = await query<{ join_code: string }>(sql, [newCode, now, classId, teacherId]);
      return res.rows[0];
    }

    targetClass.join_code = newCode;
    targetClass.updated_at = now;
    this.memClasses.set(classId, targetClass);
    return { join_code: newCode };
  }

  public async deactivateJoinCode(teacherId: string, classId: string): Promise<{ join_code: string; is_active: boolean }> {
    const targetClass = await this.getClassById(teacherId, classId);
    if (!targetClass) {
      throw new ClassAccessDeniedError();
    }

    // Set code to disabled suffix
    const disabledCode = `DISABLED-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();

    if (this.isPostgres()) {
      const sql = `
        UPDATE teacher_classes
        SET join_code = $1, updated_at = $2
        WHERE id = $3 AND teacher_id = $4
        RETURNING join_code;
      `;
      const res = await query<{ join_code: string }>(sql, [disabledCode, now, classId, teacherId]);
      return { join_code: res.rows[0].join_code, is_active: false };
    }

    targetClass.join_code = disabledCode;
    targetClass.updated_at = now;
    this.memClasses.set(classId, targetClass);
    return { join_code: disabledCode, is_active: false };
  }

  public async getClassWithDetails(
    teacherId: string,
    classId: string
  ): Promise<(TeacherClass & { student_count: number; attendance_rate: number }) | null> {
    const c = await this.getClassById(teacherId, classId);
    if (!c) return null;

    let studentCount = 0;
    let attendanceRate = 100;

    if (this.isPostgres()) {
      const countRes = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM class_students WHERE class_id = $1 AND status = 'active';`,
        [classId]
      );
      studentCount = parseInt(countRes.rows[0]?.count || '0', 10);

      const attRes = await query<{ total: string; present: string }>(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'present') as present FROM student_attendance_records WHERE class_id = $1;`,
        [classId]
      );
      const totalAtt = parseInt(attRes.rows[0]?.total || '0', 10);
      const presAtt = parseInt(attRes.rows[0]?.present || '0', 10);
      attendanceRate = totalAtt > 0 ? Math.round((presAtt / totalAtt) * 100) : 100;
    } else {
      const activeStudents = Array.from(this.memStudents.values()).filter(
        (s) => s.class_id === classId && s.status === 'active'
      );
      studentCount = activeStudents.length;

      const classAtt = Array.from(this.memAttendance.values()).filter((a) => a.class_id === classId);
      if (classAtt.length > 0) {
        const pres = classAtt.filter((a) => a.status === 'present').length;
        attendanceRate = Math.round((pres / classAtt.length) * 100);
      }
    }

    return {
      ...c,
      student_count: studentCount,
      attendance_rate: attendanceRate,
    };
  }

  public async joinClassByCode(
    studentId: string,
    joinCode: string
  ): Promise<{
    class_id: string;
    class_name: string;
    subject: string;
    grade_level: string;
    academic_year: string;
    term: string;
  }> {
    const normalizedCode = joinCode.trim().toUpperCase();

    let targetClass: TeacherClass | null = null;
    if (this.isPostgres()) {
      const sql = `
        SELECT * FROM teacher_classes
        WHERE UPPER(join_code) = $1 AND deleted_at IS NULL
        LIMIT 1;
      `;
      const res = await query<TeacherClass>(sql, [normalizedCode]);
      targetClass = res.rows[0] || null;
    } else {
      targetClass =
        Array.from(this.memClasses.values()).find(
          (c) => c.join_code.toUpperCase() === normalizedCode && !c.deleted_at
        ) || null;
    }

    if (!targetClass) {
      throw new InvalidJoinCodeError();
    }

    if (targetClass.status !== 'active') {
      throw new ClassArchivedError('CLASS_INACTIVE: الفصل غير نشط أو مؤرشف ولا يقبل طلاباً جدد');
    }

    // Check if student already enrolled
    if (this.isPostgres()) {
      const checkSql = `
        SELECT * FROM class_students
        WHERE class_id = $1 AND student_id = $2 AND status = 'active'
        LIMIT 1;
      `;
      const checkRes = await query(checkSql, [targetClass.id, studentId]);
      if (checkRes.rows.length > 0) {
        throw new StudentAlreadyEnrolledError();
      }
    } else {
      const existing = Array.from(this.memStudents.values()).find(
        (s) => s.class_id === targetClass!.id && s.student_id === studentId && s.status === 'active'
      );
      if (existing) {
        throw new StudentAlreadyEnrolledError();
      }
    }

    // Enroll student
    const id = `cs_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    const enrollment: ClassStudent = {
      id,
      class_id: targetClass.id,
      student_id: studentId,
      status: 'active',
      joined_at: now,
      updated_at: now,
    };

    if (this.isPostgres()) {
      const insertSql = `
        INSERT INTO class_students (id, class_id, student_id, status, joined_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (class_id, student_id) DO UPDATE SET status = 'active', updated_at = $6
        RETURNING *;
      `;
      await query(insertSql, [
        enrollment.id, enrollment.class_id, enrollment.student_id,
        enrollment.status, enrollment.joined_at, enrollment.updated_at,
      ]);
    } else {
      this.memStudents.set(id, enrollment);
    }

    // Return sanitized class details without revealing other students
    return {
      class_id: targetClass.id,
      class_name: targetClass.name,
      subject: targetClass.subject,
      grade_level: targetClass.grade_level,
      academic_year: targetClass.academic_year,
      term: targetClass.term,
    };
  }

  public async removeStudentFromClass(
    teacherId: string,
    classId: string,
    studentId: string
  ): Promise<boolean> {
    const targetClass = await this.getClassById(teacherId, classId);
    if (!targetClass) {
      throw new ClassAccessDeniedError();
    }

    const now = new Date().toISOString();

    if (this.isPostgres()) {
      const sql = `
        UPDATE class_students
        SET status = 'dropped', updated_at = $1
        WHERE class_id = $2 AND student_id = $3 AND status = 'active';
      `;
      const res = await query(sql, [now, classId, studentId]);
      return (res.rowCount ?? 0) > 0;
    }

    const studentRecord = Array.from(this.memStudents.values()).find(
      (s) => s.class_id === classId && s.student_id === studentId && s.status === 'active'
    );
    if (!studentRecord) return false;

    studentRecord.status = 'dropped';
    studentRecord.updated_at = now;
    return true;
  }

  /**
   * Validates structured CSV/Excel student roster records prior to import
   */
  public validateCsvStudentRecords(
    rawRecords: Array<{
      student_id?: string;
      student_name?: string;
      name?: string;
      email?: string;
      national_id?: string;
      notes?: string;
    }>
  ): {
    valid: Array<{ student_id: string; student_name: string; student_email?: string }>;
    errors: Array<{ row_index: number; record: any; reason: string }>;
    summary: {
      total: number;
      valid_count: number;
      error_count: number;
      duplicate_count: number;
    };
  } {
    const valid: Array<{ student_id: string; student_name: string; student_email?: string }> = [];
    const errors: Array<{ row_index: number; record: any; reason: string }> = [];
    const seenIds = new Set<string>();
    let duplicateCount = 0;

    rawRecords.forEach((r, idx) => {
      const rowIndex = idx + 1;
      const rawName = r.student_name || r.name;
      const rawId = r.student_id || r.national_id;
      const rawEmail = r.email;

      // Sanitize against CSV Formula injection
      const name = sanitizeCsvFormula(rawName);
      const studentId = sanitizeCsvFormula(rawId);
      const email = sanitizeCsvFormula(rawEmail);

      if (!name || name.length < 2) {
        errors.push({
          row_index: rowIndex,
          record: r,
          reason: 'اسم الطالب مطلوب ولا يقل عن حرفين',
        });
        return;
      }

      // Identifier is either student_id or email
      const uniqueKey = studentId || email;
      if (!uniqueKey) {
        errors.push({
          row_index: rowIndex,
          record: r,
          reason: 'يجب توفير الرقم التعريفي للطالب (الرقم المدني أو البريد الإلكتروني)',
        });
        return;
      }

      const lowerKey = uniqueKey.toLowerCase();
      if (seenIds.has(lowerKey)) {
        duplicateCount++;
        errors.push({
          row_index: rowIndex,
          record: r,
          reason: `تكرار في ملف الاستيراد لنفس الرقم أو البريد: ${uniqueKey}`,
        });
        return;
      }

      seenIds.add(lowerKey);
      valid.push({
        student_id: studentId || `std_${Date.now()}_${idx}`,
        student_name: name,
        student_email: email || undefined,
      });
    });

    return {
      valid,
      errors,
      summary: {
        total: rawRecords.length,
        valid_count: valid.length,
        error_count: errors.length,
        duplicate_count: duplicateCount,
      },
    };
  }

  public async importStudentsBatch(
    teacherId: string,
    classId: string,
    students: Array<{ student_id: string; student_name: string; student_email?: string }>
  ): Promise<{ imported_count: number; students: ClassStudent[] }> {
    const targetClass = await this.getClassById(teacherId, classId);
    if (!targetClass) {
      throw new ClassAccessDeniedError();
    }

    const enrolled: ClassStudent[] = [];
    for (const s of students) {
      const res = await this.enrollStudent(teacherId, classId, s.student_id);
      res.student_name = s.student_name;
      res.student_email = s.student_email;
      enrolled.push(res);
    }

    return {
      imported_count: enrolled.length,
      students: enrolled,
    };
  }

  public async updateAttendanceRecord(
    teacherId: string,
    classId: string,
    recordId: string,
    data: {
      status: 'present' | 'absent' | 'late' | 'excused';
      notes?: string;
    }
  ): Promise<StudentAttendanceRecord> {
    const targetClass = await this.getClassById(teacherId, classId);
    if (!targetClass) {
      throw new ClassAccessDeniedError();
    }

    const now = new Date().toISOString();

    if (this.isPostgres()) {
      const sql = `
        UPDATE student_attendance_records
        SET status = $1, notes = COALESCE($2, notes), updated_at = $3
        WHERE id = $4 AND class_id = $5
        RETURNING *;
      `;
      const res = await query<StudentAttendanceRecord>(sql, [
        data.status, data.notes || null, now, recordId, classId
      ]);
      if (res.rows.length === 0) {
        throw new Error('ATTENDANCE_RECORD_NOT_FOUND: سجل الحضور المطلوب غير موجود');
      }
      return res.rows[0];
    }

    const rec = this.memAttendance.get(recordId);
    if (!rec || rec.class_id !== classId) {
      throw new Error('ATTENDANCE_RECORD_NOT_FOUND: سجل الحضور المطلوب غير موجود');
    }

    rec.status = data.status;
    if (data.notes !== undefined) rec.notes = data.notes;
    rec.updated_at = now;
    return { ...rec };
  }

  public async getClassAttendanceByDate(
    teacherId: string,
    classId: string,
    date: string,
    sessionNumber?: number
  ): Promise<StudentAttendanceRecord[]> {
    const targetClass = await this.getClassById(teacherId, classId);
    if (!targetClass) {
      throw new ClassAccessDeniedError();
    }

    if (this.isPostgres()) {
      let sql = `
        SELECT a.*, p.full_name as student_name
        FROM student_attendance_records a
        JOIN users u ON a.student_id = u.id
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE a.class_id = $1 AND a.attendance_date = $2
      `;
      const params: any[] = [classId, date];
      if (sessionNumber !== undefined) {
        sql += ` AND a.session_number = $3`;
        params.push(sessionNumber);
      }
      sql += ` ORDER BY a.session_number ASC, a.created_at ASC;`;
      const res = await query<StudentAttendanceRecord>(sql, params);
      return res.rows;
    }

    return Array.from(this.memAttendance.values()).filter((a) => {
      const matchesClass = a.class_id === classId;
      const matchesDate = a.attendance_date === date;
      const matchesSession = sessionNumber !== undefined ? a.session_number === sessionNumber : true;
      return matchesClass && matchesDate && matchesSession;
    });
  }

  public async getClassAttendanceSummary(
    teacherId: string,
    classId: string
  ): Promise<{
    total_sessions: number;
    total_records: number;
    attendance_rate: number;
    student_breakdown: Array<{
      student_id: string;
      student_name?: string;
      present_count: number;
      absent_count: number;
      late_count: number;
      excused_count: number;
      rate: number;
    }>;
  }> {
    const targetClass = await this.getClassById(teacherId, classId);
    if (!targetClass) {
      throw new ClassAccessDeniedError();
    }

    const students = await this.listClassStudents(teacherId, classId);
    let allRecords: StudentAttendanceRecord[] = [];

    if (this.isPostgres()) {
      const sql = `SELECT * FROM student_attendance_records WHERE class_id = $1;`;
      const res = await query<StudentAttendanceRecord>(sql, [classId]);
      allRecords = res.rows;
    } else {
      allRecords = Array.from(this.memAttendance.values()).filter((a) => a.class_id === classId);
    }

    const distinctSessions = new Set(allRecords.map((r) => `${r.attendance_date}_${r.session_number}`));
    const totalSessions = distinctSessions.size;
    const totalRecords = allRecords.length;
    const totalPresent = allRecords.filter((r) => r.status === 'present').length;
    const overallRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 100;

    const studentBreakdown = students.map((s) => {
      const studentRecs = allRecords.filter((r) => r.student_id === s.student_id);
      const pres = studentRecs.filter((r) => r.status === 'present').length;
      const abs = studentRecs.filter((r) => r.status === 'absent').length;
      const lat = studentRecs.filter((r) => r.status === 'late').length;
      const exc = studentRecs.filter((r) => r.status === 'excused').length;
      const rate = studentRecs.length > 0 ? Math.round((pres / studentRecs.length) * 100) : 100;

      return {
        student_id: s.student_id,
        student_name: s.student_name,
        present_count: pres,
        absent_count: abs,
        late_count: lat,
        excused_count: exc,
        rate,
      };
    });

    return {
      total_sessions: totalSessions,
      total_records: totalRecords,
      attendance_rate: overallRate,
      student_breakdown: studentBreakdown,
    };
  }


  // --------------------------------------------------------------------------
  // B. STUDENT ENROLLMENT & ATTENDANCE (Strict IDOR & Duplicate Guard)
  // --------------------------------------------------------------------------

  public async enrollStudent(
    teacherId: string,
    classId: string,
    studentId: string
  ): Promise<ClassStudent> {
    // IDOR verification: Class must belong to this teacher
    const targetClass = await this.getClassById(teacherId, classId);
    if (!targetClass) {
      throw new ClassAccessDeniedError();
    }

    const id = `cs_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const record: ClassStudent = {
      id,
      class_id: classId,
      student_id: studentId,
      status: 'active',
      joined_at: now,
      updated_at: now,
    };

    if (this.isPostgres()) {
      const sql = `
        INSERT INTO class_students (id, class_id, student_id, status, joined_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (class_id, student_id) DO UPDATE SET status = 'active', updated_at = $6
        RETURNING *;
      `;
      const res = await query<ClassStudent>(sql, [
        record.id, record.class_id, record.student_id, record.status, record.joined_at, record.updated_at,
      ]);
      return res.rows[0];
    }

    // In-Memory: Check unique constraint (class_id, student_id)
    const existingKey = Array.from(this.memStudents.values()).find(
      (s) => s.class_id === classId && s.student_id === studentId
    );
    if (existingKey) {
      existingKey.status = 'active';
      existingKey.updated_at = now;
      return { ...existingKey };
    }

    this.memStudents.set(id, record);
    return { ...record };
  }

  public async listClassStudents(teacherId: string, classId: string): Promise<ClassStudent[]> {
    const targetClass = await this.getClassById(teacherId, classId);
    if (!targetClass) {
      throw new ClassAccessDeniedError();
    }

    if (this.isPostgres()) {
      const sql = `
        SELECT cs.*, p.full_name as student_name, u.email as student_email
        FROM class_students cs
        JOIN users u ON cs.student_id = u.id
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE cs.class_id = $1 AND cs.status = 'active'
        ORDER BY cs.joined_at ASC;
      `;
      const res = await query<ClassStudent>(sql, [classId]);
      return res.rows;
    }

    return Array.from(this.memStudents.values())
      .filter((s) => s.class_id === classId && s.status === 'active');
  }

  public async recordAttendance(
    teacherId: string,
    classId: string,
    records: Array<{
      student_id: string;
      attendance_date: string;
      session_number: number;
      status: 'present' | 'absent' | 'late' | 'excused';
      notes?: string;
    }>
  ): Promise<StudentAttendanceRecord[]> {
    // 1. IDOR Check: Teacher must own this class
    const targetClass = await this.getClassById(teacherId, classId);
    if (!targetClass) {
      throw new ClassAccessDeniedError();
    }

    const savedRecords: StudentAttendanceRecord[] = [];
    const now = new Date().toISOString();

    for (const r of records) {
      const id = `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const record: StudentAttendanceRecord = {
        id,
        class_id: classId,
        student_id: r.student_id,
        attendance_date: r.attendance_date,
        session_number: r.session_number,
        status: r.status,
        notes: r.notes || null,
        recorded_by: teacherId,
        created_at: now,
        updated_at: now,
      };

      if (this.isPostgres()) {
        const sql = `
          INSERT INTO student_attendance_records (
            id, class_id, student_id, attendance_date, session_number, status, notes, recorded_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (class_id, student_id, attendance_date, session_number)
          DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at
          RETURNING *;
        `;
        const res = await query<StudentAttendanceRecord>(sql, [
          record.id, record.class_id, record.student_id, record.attendance_date,
          record.session_number, record.status, record.notes, record.recorded_by,
          record.created_at, record.updated_at,
        ]);
        savedRecords.push(res.rows[0]);
      } else {
        // In-Memory: Check unique constraint on session
        const existing = Array.from(this.memAttendance.values()).find(
          (a) =>
            a.class_id === classId &&
            a.student_id === r.student_id &&
            a.attendance_date === r.attendance_date &&
            a.session_number === r.session_number
        );

        if (existing) {
          existing.status = r.status;
          existing.notes = r.notes || null;
          existing.updated_at = now;
          savedRecords.push({ ...existing });
        } else {
          this.memAttendance.set(id, record);
          savedRecords.push({ ...record });
        }
      }
    }

    return savedRecords;
  }

  // --------------------------------------------------------------------------
  // C. LESSON PLANNING & SUPERVISORY FEEDBACK
  // --------------------------------------------------------------------------

  public async createLessonPlan(
    teacherId: string,
    data: {
      title: string;
      grade_level: string;
      unit_name: string;
      lesson_date?: string;
      learning_objectives: string[];
      prior_knowledge?: string;
      required_materials?: string;
      instructional_procedures?: Array<{ step: number; activity: string; duration_minutes: number }>;
      assessment_strategies?: string;
      homework_description?: string;
      differentiation_notes?: string;
    }
  ): Promise<TeacherLessonPlan> {
    const id = `plan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const plan: TeacherLessonPlan = {
      id,
      teacher_id: teacherId,
      title: data.title.trim(),
      subject: 'كيمياء',
      grade_level: data.grade_level,
      unit_name: data.unit_name.trim(),
      lesson_date: data.lesson_date || null,
      learning_objectives: data.learning_objectives || [],
      prior_knowledge: data.prior_knowledge || null,
      required_materials: data.required_materials || null,
      instructional_procedures: data.instructional_procedures || [],
      assessment_strategies: data.assessment_strategies || null,
      homework_description: data.homework_description || null,
      differentiation_notes: data.differentiation_notes || null,
      status: 'draft',
      reviewed_by: null,
      reviewed_at: null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };

    if (this.isPostgres()) {
      const sql = `
        INSERT INTO teacher_lesson_plans (
          id, teacher_id, title, subject, grade_level, unit_name, lesson_date, learning_objectives,
          prior_knowledge, required_materials, instructional_procedures, assessment_strategies,
          homework_description, differentiation_notes, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *;
      `;
      const res = await query<TeacherLessonPlan>(sql, [
        plan.id, plan.teacher_id, plan.title, plan.subject, plan.grade_level, plan.unit_name,
        plan.lesson_date, plan.learning_objectives, plan.prior_knowledge, plan.required_materials,
        JSON.stringify(plan.instructional_procedures), plan.assessment_strategies,
        plan.homework_description, plan.differentiation_notes, plan.status,
        plan.created_at, plan.updated_at,
      ]);
      return res.rows[0];
    }

    this.memPlans.set(id, plan);
    return { ...plan };
  }

  public async getLessonPlanById(
    userId: string,
    role: string,
    planId: string
  ): Promise<TeacherLessonPlan | null> {
    const isSupervisor = ['LEAD', 'PRO'].includes(role.toUpperCase());

    if (this.isPostgres()) {
      const sql = isSupervisor
        ? `SELECT * FROM teacher_lesson_plans WHERE id = $1 AND deleted_at IS NULL LIMIT 1;`
        : `SELECT * FROM teacher_lesson_plans WHERE id = $1 AND teacher_id = $2 AND deleted_at IS NULL LIMIT 1;`;
      const params = isSupervisor ? [planId] : [planId, userId];
      const res = await query<TeacherLessonPlan>(sql, params);
      return res.rows[0] || null;
    }

    const plan = this.memPlans.get(planId);
    if (!plan || plan.deleted_at) return null;

    // Strict Access Control: Must be the author teacher OR a supervisor
    if (!isSupervisor && plan.teacher_id !== userId) {
      throw new LessonPlanAccessDeniedError();
    }

    return { ...plan };
  }

  public async addSupervisoryFeedback(
    supervisorId: string,
    supervisorRole: string,
    planId: string,
    feedback: {
      feedback_text: string;
      rating?: number;
      strengths?: string;
      recommendations?: string;
      newStatus?: 'approved' | 'rejected';
    }
  ): Promise<LessonPlanFeedback> {
    // Only LEAD or PRO can provide supervisory feedback
    if (!['LEAD', 'PRO'].includes(supervisorRole.toUpperCase())) {
      throw new LessonPlanAccessDeniedError('فقط الموجه الفني أو رئيس القسم يحق له تقديم تقييم تربوي رسمي');
    }

    const id = `fb_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const record: LessonPlanFeedback = {
      id,
      plan_id: planId,
      supervisor_id: supervisorId,
      feedback_text: feedback.feedback_text.trim(),
      rating: feedback.rating || null,
      strengths: feedback.strengths || null,
      recommendations: feedback.recommendations || null,
      created_at: now,
    };

    if (this.isPostgres()) {
      const sql = `
        INSERT INTO lesson_plan_feedback (id, plan_id, supervisor_id, feedback_text, rating, strengths, recommendations, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `;
      const res = await query<LessonPlanFeedback>(sql, [
        record.id, record.plan_id, record.supervisor_id, record.feedback_text,
        record.rating, record.strengths, record.recommendations, record.created_at,
      ]);

      if (feedback.newStatus) {
        await query(
          `UPDATE teacher_lesson_plans SET status = $1, reviewed_by = $2, reviewed_at = $3, updated_at = $3 WHERE id = $4`,
          [feedback.newStatus, supervisorId, now, planId]
        );
      }
      return res.rows[0];
    }

    this.memFeedback.set(id, record);
    const plan = this.memPlans.get(planId);
    if (plan && feedback.newStatus) {
      plan.status = feedback.newStatus;
      plan.reviewed_by = supervisorId;
      plan.reviewed_at = now;
      plan.updated_at = now;
    }

    return { ...record };
  }

  // --------------------------------------------------------------------------
  // D. ASSIGNMENTS & HOMEWORK MANAGEMENT
  // --------------------------------------------------------------------------

  public async createAssignment(
    teacherId: string,
    data: {
      class_id: string;
      title: string;
      description: string;
      due_date: string;
      max_score?: number;
      attachment_url?: string;
      allow_late_submission?: boolean;
    }
  ): Promise<TeacherAssignment> {
    const targetClass = await this.getClassById(teacherId, data.class_id);
    if (!targetClass) {
      throw new ClassAccessDeniedError();
    }

    const id = `asg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const asg: TeacherAssignment = {
      id,
      class_id: data.class_id,
      teacher_id: teacherId,
      title: data.title.trim(),
      description: data.description.trim(),
      attachment_url: data.attachment_url || null,
      max_score: data.max_score || 10.0,
      due_date: data.due_date,
      status: 'published',
      allow_late_submission: data.allow_late_submission || false,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };

    if (this.isPostgres()) {
      const sql = `
        INSERT INTO teacher_assignments (
          id, class_id, teacher_id, title, description, attachment_url, max_score, due_date, status, allow_late_submission, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
      `;
      const res = await query<TeacherAssignment>(sql, [
        asg.id, asg.class_id, asg.teacher_id, asg.title, asg.description, asg.attachment_url,
        asg.max_score, asg.due_date, asg.status, asg.allow_late_submission, asg.created_at, asg.updated_at,
      ]);
      return res.rows[0];
    }

    this.memAssignments.set(id, asg);
    return { ...asg };
  }

  public async gradeSubmission(
    teacherId: string,
    submissionId: string,
    score: number,
    feedback?: string
  ): Promise<AssignmentSubmission> {
    if (this.isPostgres()) {
      // Join to verify assignment belongs to this teacher
      const sql = `
        UPDATE assignment_submissions sub
        SET score = $1, feedback = $2, status = 'graded', graded_at = CURRENT_TIMESTAMP, graded_by = $3
        FROM teacher_assignments asg
        WHERE sub.id = $4 AND sub.assignment_id = asg.id AND asg.teacher_id = $3
        RETURNING sub.*;
      `;
      const res = await query<AssignmentSubmission>(sql, [score, feedback || null, teacherId, submissionId]);
      if (res.rowCount === 0) {
        throw new ClassAccessDeniedError('ليس لديك صلاحية رصد درجات لهذا التسليم');
      }
      return res.rows[0];
    }

    const sub = this.memSubmissions.get(submissionId);
    if (!sub) {
      throw new Error('SUBMISSION_NOT_FOUND: لم يتم العثور على تسليم الواجب المطلوب');
    }

    const asg = this.memAssignments.get(sub.assignment_id);
    if (!asg || asg.teacher_id !== teacherId) {
      throw new ClassAccessDeniedError('ليس لديك صلاحية رصد درجات لهذا التسليم');
    }

    sub.score = score;
    sub.feedback = feedback || null;
    sub.status = 'graded';
    sub.graded_at = new Date().toISOString();
    sub.graded_by = teacherId;

    return { ...sub };
  }

  // --------------------------------------------------------------------------
  // E. IN-APP NOTIFICATIONS
  // --------------------------------------------------------------------------

  public async sendNotification(
    userId: string,
    notification: {
      title: string;
      message: string;
      type: InAppNotification['type'];
      entity_id?: string;
      action_url?: string;
    }
  ): Promise<InAppNotification> {
    const id = `notif_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const entity: InAppNotification = {
      id,
      user_id: userId,
      title: notification.title.trim(),
      message: notification.message.trim(),
      type: notification.type,
      entity_id: notification.entity_id || null,
      action_url: notification.action_url || null,
      is_read: false,
      read_at: null,
      created_at: now,
    };

    if (this.isPostgres()) {
      const sql = `
        INSERT INTO in_app_notifications (id, user_id, title, message, type, entity_id, action_url, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;
      const res = await query<InAppNotification>(sql, [
        entity.id, entity.user_id, entity.title, entity.message, entity.type,
        entity.entity_id, entity.action_url, entity.is_read, entity.created_at,
      ]);
      return res.rows[0];
    }

    this.memNotifications.set(id, entity);
    return { ...entity };
  }

  public async getUserNotifications(userId: string): Promise<InAppNotification[]> {
    if (this.isPostgres()) {
      const sql = `
        SELECT * FROM in_app_notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50;
      `;
      const res = await query<InAppNotification>(sql, [userId]);
      return res.rows;
    }

    return Array.from(this.memNotifications.values())
      .filter((n) => n.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public async markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
    if (this.isPostgres()) {
      const sql = `
        UPDATE in_app_notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2;
      `;
      const res = await query(sql, [notificationId, userId]);
      return (res.rowCount ?? 0) > 0;
    }

    const n = this.memNotifications.get(notificationId);
    if (!n || n.user_id !== userId) return false;
    n.is_read = true;
    n.read_at = new Date().toISOString();
    return true;
  }
}

// Global Singleton Export
export const teacherRepo = new TeacherRepository();
