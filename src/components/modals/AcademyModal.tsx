import React, { useState } from 'react';
import { X, GraduationCap, Award, CheckCircle2, Clock, Users, ArrowLeft } from 'lucide-react';

interface AcademyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AcademyModal: React.FC<AcademyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [enrolledCourse, setEnrolledCourse] = useState<string | null>(null);

  const courses = [
    {
      id: 'course-1',
      title: 'دبلوم تدريس العلوم وفق منهجية STEM والتعلم التكاملي',
      instructor: 'د. خالد المطيري ونخبة من خبراء التوجيه الفني',
      duration: '40 ساعة تدريبية',
      format: 'هجين (حضوري وافتراضي)',
      seats: 'متاح الآن',
      level: 'متقدم',
      tag: 'مسار تخصصي'
    },
    {
      id: 'course-2',
      title: 'إدارة وتفعيل المختبرات الافتراضية الذكية في مدارس التعليم العام',
      instructor: 'م. أحمد الراشد (وحدة تكنولوجيا التعليم)',
      duration: '25 ساعة تدريبية',
      format: 'عن بُعد بالكامل',
      seats: 'متبقي 12 مقعد',
      level: 'متوسط',
      tag: 'تطبيقي معملي'
    },
    {
      id: 'course-3',
      title: 'بناء وتدقيق الاختبارات التحصيلية وفق مستويات بلوم ومؤشرات TIMSS',
      instructor: 'لجنة تطوير المعايير والتقويم التربوي',
      duration: '30 ساعة تدريبية',
      format: 'عن بُعد عبر منصة التدريب',
      seats: 'متاح الآن',
      level: 'شامل لجميع المعلمين',
      tag: 'جودة وتقويم'
    },
    {
      id: 'course-4',
      title: 'برنامج التهيئة والتمكين المهني لمعلم العلوم المستجد (دفعة 2026)',
      instructor: 'فريق خبراء ومطوري تعليم العلوم',
      duration: '50 ساعة إرشادية',
      format: 'مصاحبة ميدانية + ورش',
      seats: 'مخصص للمعلمين الجدد',
      level: 'تأسيسي',
      tag: 'NEXORA START'
    }
  ];

  const handleEnroll = (title: string) => {
    setEnrolledCourse(title);
    setTimeout(() => setEnrolledCourse(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-[#0B3D5B] text-white p-5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37] flex items-center justify-center text-[#0B3D5B] font-bold shadow-xs">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="font-latin text-xs font-bold text-[#D4AF37] tracking-wider">NEXORA ACADEMY</span>
              <h3 className="text-base sm:text-lg font-bold">أكاديمية التطوير المهني التخصصي لمعلمي العلوم</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast */}
        {enrolledCourse && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>تم تسجيل التحاقك في: "{enrolledCourse}" بنجاح! تم إرسال جدول المحاضرات لبريدك.</span>
          </div>
        )}

        {/* Content list */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-[#F8FAFC]">
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600 shrink-0" />
            <span>مسارات تدريبية ومهنية متخصصة تهدف لتنمية الكفايات التدريسية والتقنية وإثراء الملف المهني للمعلم.</span>
          </div>

          <div className="space-y-3">
            {courses.map((course) => (
              <div
                key={course.id}
                className="p-5 rounded-xl bg-white border border-slate-200 hover:border-[#D4AF37] hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1">
                    <span className="font-bold text-[#D4AF37] bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">{course.tag}</span>
                    <span>·</span>
                    <span className="text-slate-600">{course.level}</span>
                  </div>
                  <h4 className="text-sm font-bold text-[#0B3D5B] mb-1">{course.title}</h4>
                  <p className="text-xs text-slate-500 mb-2">إشراف وتقديم: {course.instructor}</p>

                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-latin">
                      <Clock className="w-3.5 h-3.5 text-[#00A7B5]" />
                      {course.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#2E9E6F]" />
                      {course.format}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleEnroll(course.title)}
                  className="px-4 py-2.5 rounded-lg text-xs font-bold text-[#0B3D5B] bg-[#D4AF37] hover:bg-[#e0c25c] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                >
                  <span>التسجيل في المسار</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>شهادات إتمام رقمية صادرة عبر منصة NEXORA</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
