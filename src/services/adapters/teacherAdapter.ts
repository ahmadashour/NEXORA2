/**
 * NEXORA Teacher Workspace Adapter
 * Translates backend domain entities into localized Arabic UI models with Tailwind styles.
 */

import {
  TeacherClassModel,
  ClassStudentModel,
  AttendanceRecordModel,
  AttendanceStatus,
  AttendanceSummaryModel,
} from '../../types/contracts';

export interface UIClassCard {
  id: string;
  name: string;
  subject: string;
  gradeLevel: string;
  academicYear: string;
  termArabic: string;
  joinCode: string;
  roomNumber: string;
  status: 'active' | 'archived' | 'completed';
  statusArabic: string;
  statusColor: string;
  studentCount: number;
  attendanceRate: number;
  createdAt: string;
}

export interface UIStudentRow {
  id: string;
  studentId: string;
  name: string;
  email: string;
  status: string;
  statusArabic: string;
  joinedAt: string;
}

export interface UIAttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  attendanceDate: string;
  sessionNumber: number;
  status: AttendanceStatus;
  statusArabic: string;
  statusColor: string;
  notes?: string;
}

export function mapTermToArabic(term: string): string {
  switch (term) {
    case 'term_1':
      return 'الفصل الدراسي الأول';
    case 'term_2':
      return 'الفصل الدراسي الثاني';
    case 'summer':
      return 'الفصل الصيفي';
    default:
      return term;
  }
}

export function mapClassStatusToArabic(status: string): { label: string; color: string } {
  switch (status) {
    case 'active':
      return { label: 'نشط', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'archived':
      return { label: 'مؤرشف', color: 'bg-slate-100 text-slate-600 border-slate-300' };
    case 'completed':
      return { label: 'مكتمل', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    default:
      return { label: status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

export function mapAttendanceStatusToArabic(status: AttendanceStatus): { label: string; color: string; bgClass: string } {
  switch (status) {
    case 'present':
      return {
        label: 'حاضر',
        color: 'text-emerald-700',
        bgClass: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      };
    case 'absent':
      return {
        label: 'غائب',
        color: 'text-rose-700',
        bgClass: 'bg-rose-50 border-rose-200 text-rose-700',
      };
    case 'late':
      return {
        label: 'متأخر',
        color: 'text-amber-700',
        bgClass: 'bg-amber-50 border-amber-200 text-amber-700',
      };
    case 'excused':
      return {
        label: 'معتذر',
        color: 'text-indigo-700',
        bgClass: 'bg-indigo-50 border-indigo-200 text-indigo-700',
      };
    default:
      return {
        label: status,
        color: 'text-slate-700',
        bgClass: 'bg-slate-100 border-slate-200 text-slate-700',
      };
  }
}

export function adaptClassToUI(c: TeacherClassModel): UIClassCard {
  const statusInfo = mapClassStatusToArabic(c.status);
  return {
    id: c.id,
    name: c.name,
    subject: c.subject || 'كيمياء',
    gradeLevel: c.grade_level,
    academicYear: c.academic_year,
    termArabic: mapTermToArabic(c.term),
    joinCode: c.join_code,
    roomNumber: c.room_number || 'غير محدد',
    status: c.status,
    statusArabic: statusInfo.label,
    statusColor: statusInfo.color,
    studentCount: c.student_count || 0,
    attendanceRate: c.attendance_rate !== undefined ? c.attendance_rate : 100,
    createdAt: c.created_at,
  };
}

export function adaptStudentToUI(s: ClassStudentModel): UIStudentRow {
  return {
    id: s.id,
    studentId: s.student_id,
    name: s.student_name || 'طالب',
    email: s.student_email || '—',
    status: s.status,
    statusArabic: s.status === 'active' ? 'منتظم' : s.status === 'dropped' ? 'منسحب' : 'موقوف',
    joinedAt: s.joined_at,
  };
}

export function mapTeacherErrorToArabic(err: any): string {
  const msg = err?.message || err?.error || '';
  if (msg.includes('FORBIDDEN_CLASS_ACCESS')) {
    return 'ليس لديك صلاحية الوصول إلى بيانات هذا الفصل أو التعديل عليه.';
  }
  if (msg.includes('CLASS_NOT_FOUND')) {
    return 'الفصل الدراسي المطلوب غير موجود في النظام.';
  }
  if (msg.includes('INVALID_JOIN_CODE')) {
    return 'رمز الانضمام غير صالح أو منتهي الصلاحية. يرجى التأكد من المعلم.';
  }
  if (msg.includes('STUDENT_ALREADY_ENROLLED')) {
    return 'أنت منضم بالفعل إلى هذا الفصل الدراسي مسبقاً.';
  }
  if (msg.includes('CLASS_ARCHIVED')) {
    return 'الفصل الدراسي مؤرشف أو مغلق ولا يقبل تعديلات أو تسجيل طلاب جدد.';
  }
  if (msg.includes('DUPLICATE_ATTENDANCE')) {
    return 'تم رصد حضور وغياب هذا الطالب في نفس الحصة والتاريخ مسبقاً.';
  }
  if (msg.includes('VALIDATION_ERROR')) {
    return 'يرجى مراجعة البيانات المدخلة والتأكد من تعبئة كافة الحقول المطلوبة.';
  }
  return msg || 'حدث خطأ غير متوقع في معالجة طلب مساحة المعلم.';
}
