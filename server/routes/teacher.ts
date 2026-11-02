import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import {
  teacherRepo,
  ClassAccessDeniedError,
  ClassNotFoundError,
  InvalidJoinCodeError,
  ClassArchivedError,
  StudentAlreadyEnrolledError,
  DuplicateAttendanceError,
} from '../db/repositories/teacherRepository';
import { db } from '../db';

const router = Router();

// ============================================================================
// 1. CLASSROOM MANAGEMENT ROUTES
// ============================================================================

/**
 * GET /api/v1/teacher/classes
 * Lists classes owned by authenticated teacher
 */
router.get(
  '/classes',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'LEAD', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const status = req.query.status as 'active' | 'archived' | 'completed' | undefined;

      const classes = await teacherRepo.listClasses(teacherId, { status });

      res.status(200).json({
        success: true,
        data: classes,
        count: classes.length,
      });
    } catch (err: unknown) {
      console.error('[TEACHER ROUTE ERROR] Failed to list classes:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر جلب قائمة الفصول الدراسية',
      });
    }
  }
);

/**
 * POST /api/v1/teacher/classes
 * Creates a new class for the authenticated teacher
 */
router.post(
  '/classes',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { name, grade_level, academic_year, term, subject, room_number } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'اسم الفصل مطلوب ويجب ألا يقل عن حرفين',
        });
        return;
      }

      if (!grade_level || typeof grade_level !== 'string') {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'المرحلة الدراسية أو الصف مطلوب',
        });
        return;
      }

      if (!academic_year || typeof academic_year !== 'string') {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'العام الدراسي مطلوب (مثال: 2024/2025)',
        });
        return;
      }

      const validTerms = ['term_1', 'term_2', 'summer'];
      if (!term || !validTerms.includes(term)) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'الفصل الدراسي غير صالح. الخيارات المتاحة: term_1, term_2, summer',
        });
        return;
      }

      const newClass = await teacherRepo.createClass(teacherId, {
        name: name.trim(),
        grade_level: grade_level.trim(),
        academic_year: academic_year.trim(),
        term,
        subject: subject && typeof subject === 'string' ? subject.trim() : 'كيمياء',
        room_number: room_number && typeof room_number === 'string' ? room_number.trim() : undefined,
      });

      // Audit Log
      await db.logActivity({
        user_id: teacherId,
        action: 'class.created',
        entity_type: 'teacher_class',
        entity_id: newClass.id,
        details: { name: newClass.name, join_code: newClass.join_code },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] as string,
      });

      res.status(201).json({
        success: true,
        data: newClass,
        message: 'تم إنشاء الفصل الدراسي ورمز الانضمام بنجاح',
      });
    } catch (err: unknown) {
      console.error('[TEACHER ROUTE ERROR] Failed to create class:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر إنشاء الفصل الدراسي',
      });
    }
  }
);

/**
 * POST /api/v1/teacher/classes/join
 * Student joins an active class using a unique join code
 */
router.post(
  '/classes/join',
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const studentId = req.user!.id;
      const { join_code } = req.body;

      if (!join_code || typeof join_code !== 'string' || join_code.trim().length < 4) {
        res.status(400).json({
          success: false,
          error: 'INVALID_JOIN_CODE',
          message: 'يرجى إدخال رمز انضمام صالح للفصل الدراسي',
        });
        return;
      }

      const joinedClass = await teacherRepo.joinClassByCode(studentId, join_code.trim());

      // Audit Log
      await db.logActivity({
        user_id: studentId,
        action: 'class.joined',
        entity_type: 'teacher_class',
        entity_id: joinedClass.class_id,
        details: { class_name: joinedClass.class_name },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] as string,
      });

      res.status(200).json({
        success: true,
        data: joinedClass,
        message: `تم الانضمام بنجاح إلى فصل: ${joinedClass.class_name}`,
      });
    } catch (err: unknown) {
      if (err instanceof InvalidJoinCodeError) {
        res.status(404).json({
          success: false,
          error: 'INVALID_JOIN_CODE',
          message: err.message,
        });
        return;
      }
      if (err instanceof ClassArchivedError) {
        res.status(400).json({
          success: false,
          error: 'CLASS_ARCHIVED',
          message: err.message,
        });
        return;
      }
      if (err instanceof StudentAlreadyEnrolledError) {
        res.status(409).json({
          success: false,
          error: 'STUDENT_ALREADY_ENROLLED',
          message: err.message,
        });
        return;
      }

      console.error('[TEACHER ROUTE ERROR] Failed to join class:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر الانضمام إلى الفصل الدراسي',
      });
    }
  }
);

/**
 * GET /api/v1/teacher/classes/:classId
 * Gets single class details + student count & attendance stats
 */
router.get(
  '/classes/:classId',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'LEAD', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { classId } = req.params;

      const classDetails = await teacherRepo.getClassWithDetails(teacherId, classId);
      if (!classDetails) {
        res.status(404).json({
          success: false,
          error: 'CLASS_NOT_FOUND',
          message: 'الفصل الدراسي المطلوب غير موجود أو ليس لديك صلاحية الوصول إليه',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: classDetails,
      });
    } catch (err: unknown) {
      if (err instanceof ClassAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CLASS_ACCESS',
          message: err.message,
        });
        return;
      }

      console.error('[TEACHER ROUTE ERROR] Failed to get class details:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر جلب تفاصيل الفصل الدراسي',
      });
    }
  }
);

/**
 * PUT /api/v1/teacher/classes/:classId
 * Updates class information
 */
router.put(
  '/classes/:classId',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { classId } = req.params;
      const { name, grade_level, academic_year, term, subject, room_number } = req.body;

      const updated = await teacherRepo.updateClass(teacherId, classId, {
        name,
        grade_level,
        academic_year,
        term,
        subject,
        room_number,
      });

      // Audit Log
      await db.logActivity({
        user_id: teacherId,
        action: 'class.updated',
        entity_type: 'teacher_class',
        entity_id: classId,
        details: { name: updated.name },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] as string,
      });

      res.status(200).json({
        success: true,
        data: updated,
        message: 'تم تحديث بيانات الفصل بنجاح',
      });
    } catch (err: unknown) {
      if (err instanceof ClassAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CLASS_ACCESS',
          message: err.message,
        });
        return;
      }
      if (err instanceof ClassArchivedError) {
        res.status(400).json({
          success: false,
          error: 'CLASS_ARCHIVED',
          message: err.message,
        });
        return;
      }

      console.error('[TEACHER ROUTE ERROR] Failed to update class:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر تحديث بيانات الفصل الدراسي',
      });
    }
  }
);

/**
 * POST /api/v1/teacher/classes/:classId/archive
 * Archives a class
 */
router.post(
  '/classes/:classId/archive',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { classId } = req.params;

      const archived = await teacherRepo.archiveClass(teacherId, classId);

      // Audit Log
      await db.logActivity({
        user_id: teacherId,
        action: 'class.archived',
        entity_type: 'teacher_class',
        entity_id: classId,
        details: {},
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] as string,
      });

      res.status(200).json({
        success: true,
        data: archived,
        message: 'تم أرشفة الفصل الدراسي بنجاح',
      });
    } catch (err: unknown) {
      if (err instanceof ClassAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CLASS_ACCESS',
          message: err.message,
        });
        return;
      }

      console.error('[TEACHER ROUTE ERROR] Failed to archive class:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر أرشفة الفصل الدراسي',
      });
    }
  }
);

/**
 * POST /api/v1/teacher/classes/:classId/regenerate-code
 * Regenerates a new unique join code for the class
 */
router.post(
  '/classes/:classId/regenerate-code',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { classId } = req.params;

      const result = await teacherRepo.regenerateJoinCode(teacherId, classId);

      // Audit Log
      await db.logActivity({
        user_id: teacherId,
        action: 'class.code_regenerated',
        entity_type: 'teacher_class',
        entity_id: classId,
        details: { new_code: result.join_code },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] as string,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'تم توليد رمز انضمام جديد بنجاح',
      });
    } catch (err: unknown) {
      if (err instanceof ClassAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CLASS_ACCESS',
          message: err.message,
        });
        return;
      }
      if (err instanceof ClassArchivedError) {
        res.status(400).json({
          success: false,
          error: 'CLASS_ARCHIVED',
          message: err.message,
        });
        return;
      }

      console.error('[TEACHER ROUTE ERROR] Failed to regenerate join code:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر إعادة توليد رمز الانضمام',
      });
    }
  }
);

/**
 * POST /api/v1/teacher/classes/:classId/deactivate-code
 * Deactivates the join code for a class
 */
router.post(
  '/classes/:classId/deactivate-code',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { classId } = req.params;

      const result = await teacherRepo.deactivateJoinCode(teacherId, classId);

      // Audit Log
      await db.logActivity({
        user_id: teacherId,
        action: 'class.code_deactivated',
        entity_type: 'teacher_class',
        entity_id: classId,
        details: {},
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] as string,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'تم تعطيل رمز الانضمام لهذا الفصل بنجاح',
      });
    } catch (err: unknown) {
      if (err instanceof ClassAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CLASS_ACCESS',
          message: err.message,
        });
        return;
      }

      console.error('[TEACHER ROUTE ERROR] Failed to deactivate join code:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر تعطيل رمز الانضمام',
      });
    }
  }
);

// ============================================================================
// 2. STUDENT ROSTER & ENROLLMENT ROUTES
// ============================================================================

/**
 * GET /api/v1/teacher/classes/:classId/students
 * Lists students enrolled in a class
 */
router.get(
  '/classes/:classId/students',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'LEAD', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { classId } = req.params;

      const students = await teacherRepo.listClassStudents(teacherId, classId);

      res.status(200).json({
        success: true,
        data: students,
        count: students.length,
      });
    } catch (err: unknown) {
      if (err instanceof ClassAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CLASS_ACCESS',
          message: err.message,
        });
        return;
      }

      console.error('[TEACHER ROUTE ERROR] Failed to list class students:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر جلب قائمة الطلاب',
      });
    }
  }
);

/**
 * POST /api/v1/teacher/classes/:classId/students
 * Manually enrolls a student by studentId
 */
router.post(
  '/classes/:classId/students',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { classId } = req.params;
      const { student_id } = req.body;

      if (!student_id || typeof student_id !== 'string') {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'معرف الطالب (student_id) مطلوب',
        });
        return;
      }

      const enrolled = await teacherRepo.enrollStudent(teacherId, classId, student_id.trim());

      res.status(201).json({
        success: true,
        data: enrolled,
        message: 'تم إضافة الطالب إلى الفصل بنجاح',
      });
    } catch (err: unknown) {
      if (err instanceof ClassAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CLASS_ACCESS',
          message: err.message,
        });
        return;
      }

      console.error('[TEACHER ROUTE ERROR] Failed to enroll student:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر إضافة الطالب إلى الفصل',
      });
    }
  }
);

/**
 * DELETE /api/v1/teacher/classes/:classId/students/:studentId
 * Drops a student from class
 */
router.delete(
  '/classes/:classId/students/:studentId',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { classId, studentId } = req.params;

      const success = await teacherRepo.removeStudentFromClass(teacherId, classId, studentId);
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'STUDENT_NOT_FOUND',
          message: 'الطالب غير موجود في هذا الفصل أو تم حذفه مسبقاً',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'تم استبعاد الطالب من الفصل بنجاح',
      });
    } catch (err: unknown) {
      if (err instanceof ClassAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CLASS_ACCESS',
          message: err.message,
        });
        return;
      }

      console.error('[TEACHER ROUTE ERROR] Failed to remove student:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر استبعاد الطالب من الفصل',
      });
    }
  }
);

/**
 * POST /api/v1/teacher/classes/:classId/students/validate-import
 * Pre-validates CSV/Excel student list, checks duplicate records and formats
 */
router.post(
  '/classes/:classId/students/validate-import',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { classId } = req.params;
      const { records } = req.body;

      // Ownership check
      const targetClass = await teacherRepo.getClassById(teacherId, classId);
      if (!targetClass) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CLASS_ACCESS',
          message: 'ليس لديك صلاحية الوصول إلى هذا الفصل الدراسي',
        });
        return;
      }

      if (!Array.isArray(records) || records.length === 0) {
        res.status(400).json({
          success: false,
          error: 'INVALID_CSV_PAYLOAD',
          message: 'الملف أو البيانات المرسلة فارغة أو غير صالحة',
        });
        return;
      }

      const validation = teacherRepo.validateCsvStudentRecords(records);

      res.status(200).json({
        success: true,
        data: validation,
        message: `تم التحقق من بنية البيانات: ${validation.summary.valid_count} صالح، ${validation.summary.error_count} غير صالح`,
      });
    } catch (err: unknown) {
      console.error('[TEACHER ROUTE ERROR] Failed to validate student CSV:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'حدث خطأ أثناء فحص ملف الطلاب',
      });
    }
  }
);

/**
 * POST /api/v1/teacher/classes/:classId/students/import
 * Commits bulk import of validated students
 */
router.post(
  '/classes/:classId/students/import',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { classId } = req.params;
      const { students } = req.body;

      if (!Array.isArray(students) || students.length === 0) {
        res.status(400).json({
          success: false,
          error: 'INVALID_PAYLOAD',
          message: 'قائمة الطلاب المعتمدين للاستيراد فارغة',
        });
        return;
      }

      const result = await teacherRepo.importStudentsBatch(teacherId, classId, students);

      // Audit Log
      await db.logActivity({
        user_id: teacherId,
        action: 'students.imported',
        entity_type: 'teacher_class',
        entity_id: classId,
        details: { count: result.imported_count },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] as string,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: `تم استيراد ${result.imported_count} طالب بنجاح إلى الفصل`,
      });
    } catch (err: unknown) {
      if (err instanceof ClassAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CLASS_ACCESS',
          message: err.message,
        });
        return;
      }

      console.error('[TEACHER ROUTE ERROR] Failed to import students:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر استيراد قائمة الطلاب',
      });
    }
  }
);

// ============================================================================
// 3. ATTENDANCE MANAGEMENT ROUTES
// ============================================================================

/**
 * GET /api/v1/teacher/classes/:classId/attendance
 * Retrieves attendance records for a specific date and optional session
 */
router.get(
  '/classes/:classId/attendance',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'LEAD', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { classId } = req.params;
      const date = req.query.date as string;
      const session = req.query.session ? parseInt(req.query.session as string, 10) : undefined;

      if (!date || typeof date !== 'string') {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'تاريخ الحصة مطلوب (صيغة YYYY-MM-DD)',
        });
        return;
      }

      const records = await teacherRepo.getClassAttendanceByDate(teacherId, classId, date, session);

      res.status(200).json({
        success: true,
        data: records,
        count: records.length,
      });
    } catch (err: unknown) {
      if (err instanceof ClassAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CLASS_ACCESS',
          message: err.message,
        });
        return;
      }

      console.error('[TEACHER ROUTE ERROR] Failed to get attendance:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر جلب سجلات الحضور والغياب',
      });
    }
  }
);

/**
 * POST /api/v1/teacher/classes/:classId/attendance
 * Batch records attendance for a class session in a single atomic operation
 */
router.post(
  '/classes/:classId/attendance',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { classId } = req.params;
      const { records } = req.body;

      if (!Array.isArray(records) || records.length === 0) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'يجب توفير مصفوفة سجلات الحضور (records)',
        });
        return;
      }

      // Validate status values
      const validStatuses = ['present', 'absent', 'late', 'excused'];
      for (const r of records) {
        if (!r.student_id || !r.attendance_date || typeof r.session_number !== 'number') {
          res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'كل سجل حضور يتطلب student_id و attendance_date و session_number',
          });
          return;
        }
        if (!validStatuses.includes(r.status)) {
          res.status(400).json({
            success: false,
            error: 'INVALID_ATTENDANCE_STATUS',
            message: 'حالة الحضور غير صالحة. الحالات المقبولة: present, absent, late, excused',
          });
          return;
        }
      }

      const savedRecords = await teacherRepo.recordAttendance(teacherId, classId, records);

      // Audit Log
      await db.logActivity({
        user_id: teacherId,
        action: 'attendance.recorded',
        entity_type: 'teacher_class',
        entity_id: classId,
        details: {
          date: records[0]?.attendance_date,
          session: records[0]?.session_number,
          count: savedRecords.length,
        },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] as string,
      });

      res.status(200).json({
        success: true,
        data: savedRecords,
        count: savedRecords.length,
        message: `تم رصد حضور وغياب ${savedRecords.length} طالب بنجاح`,
      });
    } catch (err: unknown) {
      if (err instanceof ClassAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CLASS_ACCESS',
          message: err.message,
        });
        return;
      }
      if (err instanceof DuplicateAttendanceError) {
        res.status(409).json({
          success: false,
          error: 'DUPLICATE_ATTENDANCE',
          message: err.message,
        });
        return;
      }

      console.error('[TEACHER ROUTE ERROR] Failed to record attendance:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر حفظ سجلات الحضور والغياب',
      });
    }
  }
);

/**
 * PATCH /api/v1/teacher/classes/:classId/attendance/:recordId
 * Updates single attendance record status/notes
 */
router.patch(
  '/classes/:classId/attendance/:recordId',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { classId, recordId } = req.params;
      const { status, notes } = req.body;

      const validStatuses = ['present', 'absent', 'late', 'excused'];
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          error: 'INVALID_ATTENDANCE_STATUS',
          message: 'حالة الحضور غير صالحة. الحالات المقبولة: present, absent, late, excused',
        });
        return;
      }

      const updated = await teacherRepo.updateAttendanceRecord(teacherId, classId, recordId, {
        status,
        notes,
      });

      res.status(200).json({
        success: true,
        data: updated,
        message: 'تم تعديل حالة الحضور بنجاح',
      });
    } catch (err: unknown) {
      if (err instanceof ClassAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CLASS_ACCESS',
          message: err.message,
        });
        return;
      }

      console.error('[TEACHER ROUTE ERROR] Failed to update attendance record:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر تعديل سجل الحضور',
      });
    }
  }
);

/**
 * GET /api/v1/teacher/classes/:classId/attendance/summary
 * Retrieves overall attendance summary and student breakdown
 */
router.get(
  '/classes/:classId/attendance/summary',
  authMiddleware,
  requireRole(['TEACH', 'PRO', 'LEAD', 'ADMIN']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { classId } = req.params;

      const summary = await teacherRepo.getClassAttendanceSummary(teacherId, classId);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (err: unknown) {
      if (err instanceof ClassAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CLASS_ACCESS',
          message: err.message,
        });
        return;
      }

      console.error('[TEACHER ROUTE ERROR] Failed to get attendance summary:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'تعذر جلب ملخص الحضور والغياب',
      });
    }
  }
);

export default router;
