import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Calendar,
  Plus,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Upload,
  BookOpen,
  CheckCircle,
  Clock,
  UserX,
  Archive,
  BarChart2,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { teacherService, TeacherApiError } from '../../services/teacherService';
import {
  TeacherClassModel,
  ClassStudentModel,
  AttendanceRecordModel,
  AttendanceStatus,
  AttendanceSummaryModel,
  CsvImportValidationResult,
} from '../../types/contracts';
import {
  adaptClassToUI,
  adaptStudentToUI,
  mapAttendanceStatusToArabic,
  mapTeacherErrorToArabic,
  UIClassCard,
  UIStudentRow,
} from '../../services/adapters/teacherAdapter';

interface TeacherWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  userName?: string;
}

export const TeacherWorkspaceModal: React.FC<TeacherWorkspaceModalProps> = ({
  isOpen,
  onClose,
  userRole = 'معلم علوم',
  userName = 'المعلم',
}) => {
  if (!isOpen) return null;

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'classes' | 'students' | 'attendance'>('classes');

  // Classes State
  const [classes, setClasses] = useState<TeacherClassModel[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classesLoading, setClassesLoading] = useState(false);
  const [classFilter, setClassFilter] = useState<'active' | 'archived'>('active');

  // Create Class Form State
  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newGradeLevel, setNewGradeLevel] = useState('الصف الثاني عشر علمي');
  const [newAcademicYear, setNewAcademicYear] = useState('2024/2025');
  const [newTerm, setNewTerm] = useState<'term_1' | 'term_2' | 'summer'>('term_2');
  const [newSubject, setNewSubject] = useState('كيمياء');
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Students Roster State
  const [students, setStudents] = useState<ClassStudentModel[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [singleStudentId, setSingleStudentId] = useState('');
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);

  // CSV Import State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');
  const [csvValidation, setCsvValidation] = useState<CsvImportValidationResult | null>(null);
  const [csvValidating, setCsvValidating] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);

  // Attendance State
  const [attendanceDate, setAttendanceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [sessionNumber, setSessionNumber] = useState<number>(1);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: AttendanceStatus; notes: string }>>({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummaryModel | null>(null);

  // Notifications & Feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Confirmation Modal
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Fetch Classes on Mount or Filter Change
  useEffect(() => {
    loadClasses();
  }, [classFilter]);

  const loadClasses = async () => {
    setClassesLoading(true);
    try {
      const data = await teacherService.getClasses(classFilter);
      setClasses(data);
      if (data.length > 0 && !selectedClassId) {
        setSelectedClassId(data[0].id);
      }
    } catch (err: any) {
      showToast(mapTeacherErrorToArabic(err), 'error');
    } finally {
      setClassesLoading(false);
    }
  };

  // 2. Fetch Students when Class Changes
  useEffect(() => {
    if (selectedClassId) {
      loadStudents(selectedClassId);
      loadAttendance(selectedClassId, attendanceDate, sessionNumber);
      loadAttendanceSummary(selectedClassId);
    }
  }, [selectedClassId]);

  const loadStudents = async (classId: string) => {
    setStudentsLoading(true);
    try {
      const data = await teacherService.getClassStudents(classId);
      setStudents(data);
      // Initialize attendance map for students
      const map: Record<string, { status: AttendanceStatus; notes: string }> = {};
      data.forEach((s) => {
        map[s.student_id] = { status: 'present', notes: '' };
      });
      setAttendanceMap((prev) => ({ ...map, ...prev }));
    } catch (err: any) {
      showToast(mapTeacherErrorToArabic(err), 'error');
    } finally {
      setStudentsLoading(false);
    }
  };

  const loadAttendance = async (classId: string, date: string, session: number) => {
    setAttendanceLoading(true);
    try {
      const records = await teacherService.getAttendance(classId, date, session);
      if (records && records.length > 0) {
        const map: Record<string, { status: AttendanceStatus; notes: string }> = {};
        records.forEach((r) => {
          map[r.student_id] = { status: r.status, notes: r.notes || '' };
        });
        setAttendanceMap((prev) => ({ ...prev, ...map }));
      }
    } catch {
      // Quiet fail on empty attendance for selected date
    } finally {
      setAttendanceLoading(false);
    }
  };

  const loadAttendanceSummary = async (classId: string) => {
    try {
      const summary = await teacherService.getAttendanceSummary(classId);
      setAttendanceSummary(summary);
    } catch {
      // Ignore initial summary error
    }
  };

  // Handlers
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      showToast('يرجى كتابة اسم الفصل الدراسي', 'error');
      return;
    }
    setCreateSubmitting(true);
    try {
      const created = await teacherService.createClass({
        name: newClassName.trim(),
        grade_level: newGradeLevel,
        academic_year: newAcademicYear,
        term: newTerm,
        subject: newSubject,
        room_number: newRoomNumber.trim() || undefined,
      });
      showToast(`تم إنشاء فصل "${created.name}" بنجاح!`);
      setIsCreateClassOpen(false);
      setNewClassName('');
      setNewRoomNumber('');
      loadClasses();
      setSelectedClassId(created.id);
    } catch (err: any) {
      showToast(mapTeacherErrorToArabic(err), 'error');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast('تم نسخ رمز الانضمام إلى الحافظة');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleRegenerateCode = async (classId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'إعادة توليد رمز الانضمام',
      message: 'هل أنت متأكد من رغبتك في توليد رمز انضمام جديد؟ سيتوقف الرمز القديم عن العمل فوراً.',
      onConfirm: async () => {
        try {
          const res = await teacherService.regenerateJoinCode(classId);
          showToast(`تم توليد رمز جديد: ${res.join_code}`);
          loadClasses();
        } catch (err: any) {
          showToast(mapTeacherErrorToArabic(err), 'error');
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleArchiveClass = async (classId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'أرشفة الفصل الدراسي',
      message: 'هل تريد نقل هذا الفصل إلى الأرشيف؟ لن يتمكن الطلاب من الانضمام أو تعديل البيانات.',
      onConfirm: async () => {
        try {
          await teacherService.archiveClass(classId);
          showToast('تم أرشفة الفصل الدراسي بنجاح');
          loadClasses();
        } catch (err: any) {
          showToast(mapTeacherErrorToArabic(err), 'error');
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleStudentId.trim()) {
      showToast('يرجى إدخال معرف الطالب أو رقمه المدني', 'error');
      return;
    }
    try {
      await teacherService.enrollStudent(selectedClassId, singleStudentId.trim());
      showToast('تم إضافة الطالب بنجاح');
      setSingleStudentId('');
      setIsAddStudentOpen(false);
      loadStudents(selectedClassId);
    } catch (err: any) {
      showToast(mapTeacherErrorToArabic(err), 'error');
    }
  };

  const handleRemoveStudent = (studentId: string, studentName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'استبعاد الطالب من الفصل',
      message: `هل أنت متأكد من استبعاد الطالب (${studentName}) من هذا الفصل الدراسي؟`,
      onConfirm: async () => {
        try {
          await teacherService.removeStudent(selectedClassId, studentId);
          showToast('تم استبعاد الطالب بنجاح');
          loadStudents(selectedClassId);
        } catch (err: any) {
          showToast(mapTeacherErrorToArabic(err), 'error');
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  // CSV Processing
  const handleValidateCsv = async () => {
    if (!csvRawText.trim()) {
      showToast('يرجى إدخال بيانات الطلاب', 'error');
      return;
    }
    setCsvValidating(true);
    try {
      // Parse CSV lines
      const lines = csvRawText
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const records = lines.map((line) => {
        const parts = line.split(',').map((p) => p.trim());
        return {
          student_name: parts[0] || '',
          student_id: parts[1] || '',
          email: parts[2] || '',
        };
      });

      const result = await teacherService.validateCsvImport(selectedClassId, records);
      setCsvValidation(result);
    } catch (err: any) {
      showToast(mapTeacherErrorToArabic(err), 'error');
    } finally {
      setCsvValidating(false);
    }
  };

  const handleCommitCsvImport = async () => {
    if (!csvValidation || csvValidation.valid.length === 0) return;
    setCsvImporting(true);
    try {
      const res = await teacherService.importStudents(selectedClassId, csvValidation.valid);
      showToast(`تم استيراد ${res.imported_count} طالب بنجاح!`);
      setIsCsvModalOpen(false);
      setCsvRawText('');
      setCsvValidation(null);
      loadStudents(selectedClassId);
    } catch (err: any) {
      showToast(mapTeacherErrorToArabic(err), 'error');
    } finally {
      setCsvImporting(false);
    }
  };

  // Attendance Handlers
  const handleSetStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        status,
        notes: prev[studentId]?.notes || '',
      },
    }));
  };

  const handleSetAllStatus = (status: AttendanceStatus) => {
    const updated: Record<string, { status: AttendanceStatus; notes: string }> = {};
    students.forEach((s) => {
      updated[s.student_id] = {
        status,
        notes: attendanceMap[s.student_id]?.notes || '',
      };
    });
    setAttendanceMap(updated);
  };

  const handleSaveAttendance = async () => {
    if (!selectedClassId || students.length === 0) return;
    setAttendanceSaving(true);
    try {
      const records = students.map((s) => ({
        student_id: s.student_id,
        attendance_date: attendanceDate,
        session_number: sessionNumber,
        status: attendanceMap[s.student_id]?.status || 'present',
        notes: attendanceMap[s.student_id]?.notes || undefined,
      }));

      await teacherService.recordAttendance(selectedClassId, { records });
      showToast(`تم حفظ رصد الحضور للحصة ${sessionNumber} بنجاح`);
      loadAttendanceSummary(selectedClassId);
    } catch (err: any) {
      showToast(mapTeacherErrorToArabic(err), 'error');
    } finally {
      setAttendanceSaving(false);
    }
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl max-w-5xl w-full h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right font-tajawal"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-l from-[#0B3D5B] to-[#00A7B5] text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
              <BookOpen className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-white/80">
                <span>NEXORA TEACHER WORKSPACE</span>
                <span>·</span>
                <span>{userRole}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black">مساحة المعلم الذكية — الفصول والطلاب والحضور</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-black/15 hover:bg-black/25 text-white transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Toast Banner */}
        {toastMessage && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b shrink-0 animate-in slide-in-from-top-2 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 sm:gap-6 text-xs sm:text-sm font-bold text-slate-600 overflow-x-auto">
            <button
              onClick={() => setActiveTab('classes')}
              className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center gap-2 min-h-[44px] whitespace-nowrap ${
                activeTab === 'classes'
                  ? 'border-[#00A7B5] text-[#0B3D5B]'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>إدارة الفصول الدراسية</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700">
                {classes.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('students')}
              className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center gap-2 min-h-[44px] whitespace-nowrap ${
                activeTab === 'students'
                  ? 'border-[#00A7B5] text-[#0B3D5B]'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>سجل الطلاب وقوائم الفصول</span>
              {selectedClass && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#00A7B5]/15 text-[#0B3D5B]">
                  {students.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center gap-2 min-h-[44px] whitespace-nowrap ${
                activeTab === 'attendance'
                  ? 'border-[#00A7B5] text-[#0B3D5B]'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>رصد الحضور والغياب</span>
            </button>
          </div>

          {/* Quick Active Class Selector when in students or attendance */}
          {activeTab !== 'classes' && classes.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">الفصل الحالي:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-bold text-slate-800 focus:ring-1 focus:ring-[#00A7B5] focus:outline-hidden min-h-[38px]"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.grade_level})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Modal Body Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {/* ================================================================ */}
          {/* TAB 1: CLASSES MANAGEMENT */}
          {/* ================================================================ */}
          {activeTab === 'classes' && (
            <div className="space-y-6">
              {/* Header Action Strip */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <h3 className="text-base font-bold text-slate-900">الفصول الدراسية المعتمدة</h3>
                  <p className="text-xs text-slate-500">
                    أنشئ فصولك الدراسية، وشارك رموز الانضمام الذكية، وتابع مؤشرات الحضور التراكمية.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                    <button
                      onClick={() => setClassFilter('active')}
                      className={`px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer min-h-[36px] ${
                        classFilter === 'active' ? 'bg-white text-[#0B3D5B] shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      النشطة
                    </button>
                    <button
                      onClick={() => setClassFilter('archived')}
                      className={`px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer min-h-[36px] ${
                        classFilter === 'archived' ? 'bg-white text-[#0B3D5B] shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      المؤرشفة
                    </button>
                  </div>

                  <button
                    onClick={() => setIsCreateClassOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0B3D5B] hover:bg-[#072a3f] text-white text-xs sm:text-sm font-bold rounded-lg transition-colors cursor-pointer min-h-[44px] shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إنشاء فصل دراسي</span>
                  </button>
                </div>
              </div>

              {/* Classes List Cards */}
              {classesLoading ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-[#00A7B5] animate-spin mx-auto mb-3" />
                  <p className="text-xs">جاري تحميل الفصول الدراسية...</p>
                </div>
              ) : classes.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-xl border border-dashed border-slate-300 p-6">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-700">لا توجد فصول دراسية في هذه القائمة</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    ابدأ بإنشاء فصل دراسي جديد لمادة العلوم/الكيمياء لتوليد رمز انضمام الطلاب وتفعيل سجل الحضور.
                  </p>
                  <button
                    onClick={() => setIsCreateClassOpen(true)}
                    className="mt-4 px-4 py-2 bg-[#00A7B5] text-white text-xs font-bold rounded-lg hover:bg-[#008f9c] transition-colors cursor-pointer min-h-[44px]"
                  >
                    إنشاء أول فصل الآن
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map((cls) => {
                    const uiCls = adaptClassToUI(cls);
                    return (
                      <div
                        key={cls.id}
                        className="bg-white rounded-xl border border-slate-200 hover:border-[#00A7B5]/40 transition-all p-4 shadow-2xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${uiCls.statusColor}`}>
                              {uiCls.statusArabic}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">{uiCls.academicYear}</span>
                          </div>

                          <h4 className="text-base font-black text-[#0B3D5B]">{uiCls.name}</h4>
                          <p className="text-xs text-slate-600 mt-0.5">{uiCls.gradeLevel} · {uiCls.subject}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">القاعة: {uiCls.roomNumber} · {uiCls.termArabic}</p>

                          {/* Join Code Box */}
                          <div className="mt-3 p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-amber-800 block">رمز انضمام الطلاب:</span>
                              <span className="text-xs font-mono font-black tracking-wider text-amber-950">
                                {uiCls.joinCode}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleCopyCode(uiCls.joinCode)}
                                className="p-1.5 rounded-md hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                                title="نسخ رمز الانضمام"
                              >
                                {copiedCode === uiCls.joinCode ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                              {cls.status === 'active' && (
                                <button
                                  onClick={() => handleRegenerateCode(cls.id)}
                                  className="p-1.5 rounded-md hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                                  title="إعادة توليد رمز جديد"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Stats Strip */}
                          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-[10px] text-slate-500 block">عدد الطلاب</span>
                              <span className="text-sm font-bold text-slate-800 font-latin">
                                {uiCls.studentCount}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-[10px] text-slate-500 block">نسبة الحضور</span>
                              <span className="text-sm font-bold text-emerald-600 font-latin">
                                {uiCls.attendanceRate}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedClassId(cls.id);
                              setActiveTab('students');
                            }}
                            className="flex-1 py-2 rounded-lg bg-[#00A7B5]/10 hover:bg-[#00A7B5]/20 text-[#0B3D5B] text-xs font-bold transition-colors cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>الطلاب</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedClassId(cls.id);
                              setActiveTab('attendance');
                            }}
                            className="flex-1 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>رصد الحضور</span>
                          </button>

                          {cls.status === 'active' && (
                            <button
                              onClick={() => handleArchiveClass(cls.id)}
                              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                              title="أرشفة الفصل"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: STUDENTS ROSTER & BULK IMPORT */}
          {/* ================================================================ */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              {/* Header Strip */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    قائمة طلاب فصل: {selectedClass ? selectedClass.name : '—'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    يمكن للطلاب الانضمام عبر الرمز الذكي، أو يمكنك استيراد كشف الأسماء من ملف Excel / CSV.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAddStudentOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer min-h-[44px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة طالب</span>
                  </button>

                  <button
                    onClick={() => setIsCsvModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#00A7B5] hover:bg-[#008f9c] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer min-h-[44px]"
                  >
                    <Upload className="w-4 h-4" />
                    <span>استيراد كشف Excel / CSV</span>
                  </button>
                </div>
              </div>

              {/* Students Table */}
              {studentsLoading ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-[#00A7B5] animate-spin mx-auto mb-3" />
                  <p className="text-xs">جاري تحميل قائمة الطلاب...</p>
                </div>
              ) : students.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-xl border border-dashed border-slate-300 p-6">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-700">لا يوجد طلاب مسجلون في هذا الفصل حالياً</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    شارك رمز الانضمام ({selectedClass?.join_code}) مع طلابك أو استخدم زر الاستيراد السريع.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-3.5 px-4 w-12 text-center">#</th>
                          <th className="py-3.5 px-4">اسم الطالب</th>
                          <th className="py-3.5 px-4">الرقم التعريفي / البريد</th>
                          <th className="py-3.5 px-4">تاريخ الانضمام</th>
                          <th className="py-3.5 px-4">حالة القيد</th>
                          <th className="py-3.5 px-4 text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.map((st, idx) => {
                          const uiSt = adaptStudentToUI(st);
                          return (
                            <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-4 font-bold text-slate-900">{uiSt.name}</td>
                              <td className="py-3 px-4 text-slate-600 font-mono">{uiSt.studentId}</td>
                              <td className="py-3 px-4 text-slate-500 font-mono">
                                {uiSt.joinedAt ? uiSt.joinedAt.split('T')[0] : '—'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {uiSt.statusArabic}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => handleRemoveStudent(st.student_id, uiSt.name)}
                                  className="p-2 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer min-w-[36px] min-h-[36px] inline-flex items-center justify-center"
                                  title="استبعاد من الفصل"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: ATTENDANCE & SUMMARY */}
          {/* ================================================================ */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              {/* Controls Strip */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">تاريخ الحصة:</label>
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => {
                        setAttendanceDate(e.target.value);
                        if (selectedClassId) loadAttendance(selectedClassId, e.target.value, sessionNumber);
                      }}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-1 focus:ring-[#00A7B5] min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">الحصة الدراسية:</label>
                    <select
                      value={sessionNumber}
                      onChange={(e) => {
                        const s = parseInt(e.target.value, 10);
                        setSessionNumber(s);
                        if (selectedClassId) loadAttendance(selectedClassId, attendanceDate, s);
                      }}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-[#00A7B5] min-h-[44px]"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                        <option key={num} value={num}>
                          الحصة {num}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Batch Status Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500">رصد سريع:</span>
                  <button
                    onClick={() => handleSetAllStatus('present')}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold cursor-pointer min-h-[44px]"
                  >
                    الكل حاضر
                  </button>
                  <button
                    onClick={() => handleSetAllStatus('absent')}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold cursor-pointer min-h-[44px]"
                  >
                    الكل غائب
                  </button>

                  <button
                    onClick={handleSaveAttendance}
                    disabled={attendanceSaving || students.length === 0}
                    className="px-4 py-2 bg-[#0B3D5B] hover:bg-[#072a3f] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer min-h-[44px] flex items-center gap-2 shadow-xs disabled:opacity-50"
                  >
                    {attendanceSaving ? (
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>حفظ رصد الحضور</span>
                  </button>
                </div>
              </div>

              {/* Attendance Sheet */}
              {students.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-xl border border-dashed border-slate-300 p-6">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-700">لا يوجد طلاب مسجلون لرصد حضورهم</h4>
                  <p className="text-xs text-slate-500 mt-1">يرجى تسجيل الطلاب في الفصل أولاً لتفعيل كشف الرصد.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4 w-12 text-center">#</th>
                          <th className="py-3 px-4">اسم الطالب</th>
                          <th className="py-3 px-4 text-center">حالة الحضور (انقر للاختيار)</th>
                          <th className="py-3 px-4">ملاحظات الحصة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.map((st, idx) => {
                          const currentStatus = attendanceMap[st.student_id]?.status || 'present';
                          const notes = attendanceMap[st.student_id]?.notes || '';
                          const statusList: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

                          return (
                            <tr key={st.student_id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-4 font-bold text-slate-900">
                                {st.student_name || 'طالب'}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-center gap-1.5">
                                  {statusList.map((stat) => {
                                    const info = mapAttendanceStatusToArabic(stat);
                                    const isSelected = currentStatus === stat;
                                    return (
                                      <button
                                        key={stat}
                                        onClick={() => handleSetStudentStatus(st.student_id, stat)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[44px] min-w-[56px] border ${
                                          isSelected
                                            ? `${info.bgClass} shadow-2xs scale-105 font-black ring-1 ring-offset-1`
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                        }`}
                                      >
                                        {info.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  placeholder="ملاحظة..."
                                  value={notes}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAttendanceMap((prev) => ({
                                      ...prev,
                                      [st.student_id]: {
                                        status: prev[st.student_id]?.status || 'present',
                                        notes: val,
                                      },
                                    }));
                                  }}
                                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-[#00A7B5] min-h-[38px]"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Attendance Summary Strip */}
              {attendanceSummary && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 className="w-4 h-4 text-[#00A7B5]" />
                    <h4 className="text-xs font-bold text-slate-900">المؤشرات الإجمالية للحضور والغياب للفصل:</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">إجمالي الحصص المرصودة</span>
                      <span className="text-lg font-black text-slate-900 font-latin">
                        {attendanceSummary.total_sessions}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">إجمالي سجلات الطلاب</span>
                      <span className="text-lg font-black text-slate-900 font-latin">
                        {attendanceSummary.total_records}
                      </span>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-emerald-700 block">نسبة الحضور الإجمالية</span>
                      <span className="text-lg font-black text-emerald-800 font-latin">
                        {attendanceSummary.attendance_rate}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* SUB-MODAL: CREATE CLASS */}
        {/* ================================================================ */}
        {isCreateClassOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-right">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <h4 className="text-base font-bold text-slate-900">إنشاء فصل دراسي جديد</h4>
                <button
                  onClick={() => setIsCreateClassOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateClass} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">اسم الفصل الدراسي *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: فصل 12 علمي / 1"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#00A7B5] min-h-[44px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">المادة</label>
                    <input
                      type="text"
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">المرحلة / الصف</label>
                    <select
                      value={newGradeLevel}
                      onChange={(e) => setNewGradeLevel(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg min-h-[44px]"
                    >
                      <option value="الصف العاشر">الصف العاشر</option>
                      <option value="الصف الحادي عشر علمي">الصف الحادي عشر علمي</option>
                      <option value="الصف الثاني عشر علمي">الصف الثاني عشر علمي</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">الفصل الدراسي</label>
                    <select
                      value={newTerm}
                      onChange={(e) => setNewTerm(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg min-h-[44px]"
                    >
                      <option value="term_1">الفصل الأول</option>
                      <option value="term_2">الفصل الثاني</option>
                      <option value="summer">الفصل الصيفي</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">العام الدراسي</label>
                    <input
                      type="text"
                      value={newAcademicYear}
                      onChange={(e) => setNewAcademicYear(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg min-h-[44px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">رقم القاعة / المختبر (اختياري)</label>
                  <input
                    type="text"
                    placeholder="مختبر الكيمياء رقم 2"
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg min-h-[44px]"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateClassOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg min-h-[44px] cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={createSubmitting}
                    className="px-5 py-2 bg-[#0B3D5B] hover:bg-[#072a3f] text-white font-bold rounded-lg min-h-[44px] cursor-pointer flex items-center gap-2"
                  >
                    {createSubmitting && (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    )}
                    <span>إنشاء الفصل</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* SUB-MODAL: CSV BULK IMPORT */}
        {/* ================================================================ */}
        {isCsvModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
            <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 text-right">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#00A7B5]" />
                  <h4 className="text-base font-bold text-slate-900">استيراد كشف الطلاب (CSV / نص منسق)</h4>
                </div>
                <button
                  onClick={() => setIsCsvModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                  <p className="font-bold mb-1">صيغة البيانات المقبولة:</p>
                  <p className="font-mono text-[11px] dir-ltr text-left">
                    اسم الطالب, الرقم المدني/التعريفي, البريد الإلكتروني
                  </p>
                  <p className="text-[11px] text-blue-700 mt-1">
                    مثال: أحمد عبد الله الكندري, 208123456789, ahmad@school.kw
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">الصق البيانات هنا (سطر لكل طالب):</label>
                  <textarea
                    rows={6}
                    value={csvRawText}
                    onChange={(e) => setCsvRawText(e.target.value)}
                    placeholder="أحمد محمد, 2081010101, ahmed@school.kw&#10;خالد فهد, 2082020202, khaled@school.kw"
                    className="w-full p-3 border border-slate-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-[#00A7B5]"
                  />
                </div>

                {/* Validation Results Strip */}
                {csvValidation && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-emerald-700">✓ صالح للاستيراد: {csvValidation.summary.valid_count}</span>
                      <span className="text-rose-700">✗ أخطاء: {csvValidation.summary.error_count}</span>
                      <span className="text-amber-700">تكرارات: {csvValidation.summary.duplicate_count}</span>
                    </div>

                    {csvValidation.errors.length > 0 && (
                      <div className="max-h-24 overflow-y-auto text-[11px] text-rose-700 space-y-1">
                        {csvValidation.errors.map((err, i) => (
                          <div key={i}>
                            سطر {err.row_index}: {err.reason}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCsvModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg min-h-[44px] cursor-pointer"
                  >
                    إلغاء
                  </button>

                  <button
                    type="button"
                    onClick={handleValidateCsv}
                    disabled={csvValidating || !csvRawText.trim()}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg min-h-[44px] cursor-pointer"
                  >
                    {csvValidating ? 'جاري الفحص...' : 'فحص والتحقق من الملف'}
                  </button>

                  {csvValidation && csvValidation.valid.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCommitCsvImport}
                      disabled={csvImporting}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg min-h-[44px] cursor-pointer flex items-center gap-2"
                    >
                      {csvImporting && (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      )}
                      <span>تأكيد استيراد {csvValidation.summary.valid_count} طالب</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* SUB-MODAL: ADD SINGLE STUDENT */}
        {/* ================================================================ */}
        {isAddStudentOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
            <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-right">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
                <h4 className="text-sm font-bold text-slate-900">إضافة طالب إلى الفصل</h4>
                <button
                  onClick={() => setIsAddStudentOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddSingleStudent} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">الرقم المدني أو معرف الطالب *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 208123456789"
                    value={singleStudentId}
                    onChange={(e) => setSingleStudentId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-[#00A7B5] min-h-[44px]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddStudentOpen(false)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg min-h-[44px]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0B3D5B] hover:bg-[#072a3f] text-white font-bold rounded-lg min-h-[44px]"
                  >
                    إضافة الطالب
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* CONFIRMATION DIALOG */}
        {/* ================================================================ */}
        {confirmDialog && confirmDialog.isOpen && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs">
            <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-right">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="text-sm font-bold text-slate-900">{confirmDialog.title}</h4>
              </div>
              <p className="text-xs text-slate-600 mb-4">{confirmDialog.message}</p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold min-h-[44px] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold min-h-[44px] cursor-pointer shadow-xs"
                >
                  تأكيد الإجراء
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
