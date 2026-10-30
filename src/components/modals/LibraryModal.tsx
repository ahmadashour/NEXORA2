import React, { useState } from 'react';
import { X, Library, Search, Download, BookOpen, FileText, CheckCircle2 } from 'lucide-react';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const libraryItems = [
    {
      id: 'lib-1',
      title: 'دليل المعلم الشامل لتدريس الكيمياء الحرارية والتوازن',
      grade: 'الصف العاشر',
      subject: 'كيمياء',
      pages: '148 صفحة',
      type: 'دليل استرشادي للمعلم',
      size: '8.4 MB'
    },
    {
      id: 'lib-2',
      title: 'أطلس التجارب العملية لمختبرات الفيزياء المدرسية',
      grade: 'المرحلة الثانوية',
      subject: 'فيزياء',
      pages: '96 صفحة',
      type: 'كراسة تجارب مخبرية',
      size: '12.1 MB'
    },
    {
      id: 'lib-3',
      title: 'مصفوفة الكفايات التخصصية وأدلة التقويم لمادة الأحياء',
      grade: 'الصف الحادي عشر والثاني عشر',
      subject: 'أحياء',
      pages: '110 صفحة',
      type: 'دليل الكفايات والتقويم',
      size: '6.7 MB'
    },
    {
      id: 'lib-4',
      title: 'كتاب الطالب لمقرر الجيولوجيا وعلوم الأرض',
      grade: 'الصف الحادي عشر علمي',
      subject: 'جيولوجيا',
      pages: '184 صفحة',
      type: 'مرجع منهجي شامل',
      size: '18.2 MB'
    },
    {
      id: 'lib-5',
      title: 'معايير الأمن والسلامة وإدارة النفايات الكيميائية في المختبرات',
      grade: 'جميع المراحل',
      subject: 'علوم عامة',
      pages: '64 صفحة',
      type: 'دليل إجرائي ومخبري',
      size: '3.9 MB'
    },
    {
      id: 'lib-6',
      title: 'حقيبة أنشطة STEM المبتكرة للمرحلة المتوسطة',
      grade: 'المرحلة المتوسطة',
      subject: 'علوم عامة',
      pages: '88 صفحة',
      type: 'حقيبة تدريبية',
      size: '9.5 MB'
    }
  ];

  const filtered = libraryItems.filter(item => {
    const matchesSubject = filterSubject === 'all' || item.subject === filterSubject;
    const matchesSearch = !search || item.title.includes(search) || item.grade.includes(search);
    return matchesSubject && matchesSearch;
  });

  const handleDownload = (title: string) => {
    setDownloadSuccess(`الملف الرقمي الخاص بـ "${title}" متاح للمعاينة المنهجية حالياً — التحميل المباشر قيد الربط بمستودع التخزين السحابي.`);
    setTimeout(() => setDownloadSuccess(null), 3500);
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
            <div className="w-10 h-10 rounded-xl bg-[#00A7B5] flex items-center justify-center text-white shadow-xs">
              <Library className="w-5 h-5" />
            </div>
            <div>
              <span className="font-latin text-xs font-bold text-[#00A7B5] tracking-wider">NEXORA LIBRARY</span>
              <h3 className="text-base sm:text-lg font-bold">المكتبة العلمية الشاملة والمستودع الرقمي</h3>
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

        {/* Filter and Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في عناوين المناهج والأدلة..."
              className="w-full bg-white border border-slate-200 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs">
            {['all', 'كيمياء', 'فيزياء', 'أحياء', 'جيولوجيا', 'علوم عامة'].map((sub) => (
              <button
                key={sub}
                onClick={() => setFilterSubject(sub)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  filterSubject === sub 
                    ? 'bg-[#0B3D5B] text-white' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {sub === 'all' ? 'جميع التخصصات' : sub}
              </button>
            ))}
          </div>
        </div>

        {/* Notice */}
        {downloadSuccess && (
          <div className="bg-cyan-50 border-b border-cyan-200 px-6 py-2.5 text-xs text-cyan-900 flex items-center gap-2">
            <Library className="w-4 h-4 text-[#00A7B5] shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        {/* Library Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 bg-[#F8FAFC]">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-white border border-slate-200 hover:border-[#00A7B5]/40 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#00A7B5]/10 text-[#00A7B5] flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1">
                      <span className="font-semibold text-slate-700">{item.subject}</span>
                      <span>·</span>
                      <span>{item.grade}</span>
                      <span>·</span>
                      <span className="text-[#00A7B5]">{item.type}</span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#0B3D5B]">{item.title}</h4>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">{item.pages} · {item.size} · PDF عالي الدقة</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDownload(item.title)}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-[#0B3D5B] hover:bg-[#072a3f] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تحميل الملف الرقمي</span>
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              لا توجد مصادر مطابقة لمعايير البحث الحالية في المكتبة.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>المصادر محدثة طبقاً للخطط الدراسية لعام 2026</span>
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
