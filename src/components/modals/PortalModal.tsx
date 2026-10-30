import React, { useState } from 'react';
import { X, CheckCircle, ArrowLeft, ExternalLink, ShieldAlert, Sparkles, BookOpen, Layers } from 'lucide-react';
import { PortalItem } from '../../types';

interface PortalModalProps {
  portal: PortalItem | null;
  onClose: () => void;
  onLaunchVirtualLab?: () => void;
  onOpenAiAssistant?: () => void;
}

export const PortalModal: React.FC<PortalModalProps> = ({
  portal,
  onClose,
  onLaunchVirtualLab,
  onOpenAiAssistant
}) => {
  if (!portal) return null;

  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'quick-tools'>('overview');
  const [notification, setNotification] = useState<string | null>(null);

  const handleAction = (feature: string) => {
    setNotification(`تم فتح أداة: "${feature}" بنجاح في بيئة ${portal.nameAr}.`);
    setTimeout(() => setNotification(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div 
          className="p-6 text-white relative flex items-start justify-between"
          style={{ backgroundColor: portal.accentColor }}
        >
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80 mb-1">
              <span className="font-latin tracking-wider">{portal.nameEn}</span>
              <span>·</span>
              <span>{portal.targetRole}</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black">{portal.nameAr}</h3>
            <p className="text-xs sm:text-sm text-white/90 mt-1 max-w-xl">{portal.description}</p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-black/15 hover:bg-black/25 text-white transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 border-b border-slate-200 flex items-center gap-4 bg-slate-50 text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'overview' 
                ? 'border-[#00A7B5] text-[#0B3D5B]' 
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            نظرة عامة والمؤشرات
          </button>
          <button
            onClick={() => setActiveTab('modules')}
            className={`py-3.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'modules' 
                ? 'border-[#00A7B5] text-[#0B3D5B]' 
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            الخدمات والأدوات التخصصية
          </button>
          <button
            onClick={() => setActiveTab('quick-tools')}
            className={`py-3.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'quick-tools' 
                ? 'border-[#00A7B5] text-[#0B3D5B]' 
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            الربط بالمختبر والمساعد الذكي
          </button>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'overview' && (
            <div>
              {/* Stats KPI Strip */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {portal.stats.map((st, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 text-center">
                    <span className="text-xl sm:text-2xl font-black text-[#0B3D5B] block font-latin">
                      {st.value}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {st.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Core Features list with triggerable action */}
              <h4 className="text-sm font-bold text-slate-900 mb-3">أبرز اختصاصات بيئة العمل:</h4>
              <div className="space-y-2.5">
                {portal.features.map((feat, index) => (
                  <div 
                    key={index}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 text-xs text-slate-700">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: portal.accentColor }} />
                      <span>{feat}</span>
                    </div>

                    <button
                      onClick={() => handleAction(feat)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 shrink-0 cursor-pointer shadow-2xs"
                      style={{ backgroundColor: portal.accentColor }}
                    >
                      فتح الأداة
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'modules' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                صُممت أدوات هذه البوابة استناداً إلى أحدث المعايير وأفضل الممارسات المنهجية في تدريس العلوم.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <h5 className="text-xs font-bold text-[#0B3D5B] mb-1">وحدة التدقيق والمطابقة</h5>
                  <p className="text-[11px] text-slate-600 mb-3">فحص جاهزية المعامل ومطابقة الخطط الأسبوعية للكفايات والمعايير المنهجية.</p>
                  <button 
                    onClick={() => handleAction('وحدة التدقيق والمطابقة')}
                    className="text-xs font-semibold text-[#00A7B5] hover:underline"
                  >
                    بدء الفحص السريع ←
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <h5 className="text-xs font-bold text-[#0B3D5B] mb-1">بنك التقارير الموحدة</h5>
                  <p className="text-[11px] text-slate-600 mb-3">تصدير تقارير التحصيل الفصلية واستمارات المتابعة بصيغة PDF مهنية.</p>
                  <button 
                    onClick={() => handleAction('بنك التقارير الموحدة')}
                    className="text-xs font-semibold text-[#00A7B5] hover:underline"
                  >
                    استعراض النماذج ←
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quick-tools' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#00A7B5]/5 border border-[#00A7B5]/20 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-[#0B3D5B]">المختبر الافتراضي (NEXORA LAB)</h5>
                  <p className="text-[11px] text-slate-600">تنفيذ التجارب المباشرة ومشاركتها مع مستخدمي البوابة.</p>
                </div>
                {onLaunchVirtualLab && (
                  <button
                    onClick={() => {
                      onClose();
                      onLaunchVirtualLab();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#00A7B5] hover:bg-[#008591] transition-colors"
                  >
                    تشغيل المختبر
                  </button>
                )}
              </div>

              <div className="p-4 rounded-xl bg-[#2E9E6F]/5 border border-[#2E9E6F]/20 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-[#0B3D5B]">المساعد التربوي الذكي</h5>
                  <p className="text-[11px] text-slate-600">طلب استشارات تدريسية وصياغة أهداف ونماذج تقييم معيارية.</p>
                </div>
                {onOpenAiAssistant && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAiAssistant();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#2E9E6F] hover:bg-[#25835b] transition-colors"
                  >
                    فتح المساعد
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            حالة المصادقة: <strong className="text-emerald-700">جلسة عمل نشطة ومؤمّنة</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
};
