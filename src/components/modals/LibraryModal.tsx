import React, { useState, useEffect } from 'react';
import { X, Library, Search, Download, FileText, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useLibrary } from '../../hooks/useLibrary';
import { LibraryResourceViewModel } from '../../types/contracts';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SUBJECT_OPTIONS = ['all', 'كيمياء', 'فيزياء', 'أحياء', 'جيولوجيا', 'علوم عامة'];

export const LibraryModal: React.FC<LibraryModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [activeSubject, setActiveSubject] = useState<string>('all');
  const [searchInput, setSearchInput] = useState<string>('');

  const {
    resources,
    isLoading,
    error,
    downloadingId,
    downloadSuccessMessage,
    downloadError,
    loadResources,
    handleDownload,
    clearMessages,
  } = useLibrary({
    autoFetch: true,
    initialSubject: 'all',
    initialSearch: '',
    limit: 30,
  });

  // Re-fetch when subject changes
  const handleSubjectChange = (subject: string) => {
    setActiveSubject(subject);
    clearMessages();
    loadResources({ subject, search: searchInput });
  };

  // Handle search submit or change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      clearMessages();
      loadResources({ subject: activeSubject, search: searchInput });
    }
  };

  // Perform search on button or blur if changed
  const triggerSearch = () => {
    clearMessages();
    loadResources({ subject: activeSubject, search: searchInput });
  };

  // Auto-dismiss success or error banners after 4 seconds
  useEffect(() => {
    if (downloadSuccessMessage || downloadError) {
      const timer = setTimeout(() => {
        clearMessages();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [downloadSuccessMessage, downloadError, clearMessages]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-modal-title"
      >
        {/* Header */}
        <div className="bg-[#0B3D5B] text-white p-5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00A7B5] flex items-center justify-center text-white shadow-xs">
              <Library className="w-5 h-5" />
            </div>
            <div>
              <span className="font-latin text-xs font-bold text-[#00A7B5] tracking-wider">NEXORA LIBRARY</span>
              <h3 id="library-modal-title" className="text-base sm:text-lg font-bold">المكتبة العلمية الشاملة والمستودع الرقمي</h3>
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
            <button
              type="button"
              onClick={triggerSearch}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-[#00A7B5] transition-colors cursor-pointer"
              title="بحث"
              aria-label="بحث"
            >
              <Search className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={searchInput}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder="ابحث في عناوين المناهج والأدلة..."
              className="w-full bg-white border border-slate-200 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs pb-1 sm:pb-0">
            {SUBJECT_OPTIONS.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => handleSubjectChange(sub)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeSubject === sub 
                    ? 'bg-[#0B3D5B] text-white' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {sub === 'all' ? 'جميع التخصصات' : sub}
              </button>
            ))}
          </div>
        </div>

        {/* Success Notice */}
        {downloadSuccessMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-xs text-emerald-900 flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{downloadSuccessMessage}</span>
            </div>
            <button
              onClick={clearMessages}
              className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer"
              aria-label="إغلاق التنبيه"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Download Error Notice */}
        {downloadError && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2.5 text-xs text-red-900 flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{downloadError}</span>
            </div>
            <button
              onClick={clearMessages}
              className="text-red-700 hover:text-red-900 text-xs cursor-pointer"
              aria-label="إغلاق التنبيه"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Library Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 bg-[#F8FAFC]">
          {/* 1. Loading State */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-white border border-slate-200 animate-pulse flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 w-full sm:w-2/3">
                    <div className="w-9 h-9 rounded-lg bg-slate-200 shrink-0" />
                    <div className="space-y-2 w-full">
                      <div className="h-3 w-1/3 bg-slate-200 rounded-sm" />
                      <div className="h-4 w-3/4 bg-slate-200 rounded-sm" />
                      <div className="h-3 w-1/2 bg-slate-100 rounded-sm" />
                    </div>
                  </div>
                  <div className="h-8 w-28 bg-slate-200 rounded-lg shrink-0 self-end sm:self-auto" />
                </div>
              ))}
            </div>
          )}

          {/* 2. Error State */}
          {!isLoading && error && (
            <div className="p-8 text-center bg-white rounded-xl border border-red-200 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">تعذر تحميل مصادر المكتبة الرقمية</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">{error}</p>
              <button
                type="button"
                onClick={() => loadResources({ subject: activeSubject, search: searchInput })}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B3D5B] text-white text-xs font-bold hover:bg-[#072a3f] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة المحاولة</span>
              </button>
            </div>
          )}

          {/* 3. Empty State */}
          {!isLoading && !error && resources.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
              لا توجد مصادر مطابقة لمعايير البحث الحالية في المكتبة.
            </div>
          )}

          {/* 4. Loaded Resources List */}
          {!isLoading && !error && resources.length > 0 && (
            resources.map((item: LibraryResourceViewModel) => {
              const isCurrentDownloading = downloadingId === item.id;
              const isAnyDownloading = downloadingId !== null;

              return (
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
                        <span className="text-[#00A7B5]">{item.fileType}</span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0B3D5B]">{item.title}</h4>
                      {item.description && (
                        <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">{item.description}</p>
                      )}
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        {item.publisher} · {item.fileSizeFormatted} · {item.downloadsCount} تحميلاً
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isAnyDownloading}
                    onClick={() => handleDownload(item)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-2xs ${
                      isCurrentDownloading
                        ? 'bg-[#00A7B5] cursor-wait'
                        : isAnyDownloading
                        ? 'bg-slate-400 cursor-not-allowed opacity-60'
                        : 'bg-[#0B3D5B] hover:bg-[#072a3f] cursor-pointer'
                    }`}
                  >
                    {isCurrentDownloading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>جارٍ التجهيز...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>تحميل الملف الرقمي</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
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
