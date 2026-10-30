import React from 'react';
import { X, ShieldCheck, Lock, FileText, CheckCircle } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-[#0B3D5B] text-white p-5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00A7B5] flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-latin text-xs font-bold text-[#00A7B5] tracking-wider">LEGAL & PRIVACY</span>
              <h3 className="text-base sm:text-lg font-bold">سياسة الخصوصية وحقوق الملكية الفكرية</h3>
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-700 text-xs sm:text-sm leading-relaxed">
          <div className="p-3 bg-cyan-50/60 border border-cyan-200 rounded-xl text-slate-800">
            <strong>مبادئ حماية البيانات التعليمية:</strong> تلتزم منصة NEXORA بأعلى معايير حماية الخصوصية الرقمية للكوادر التعليمية والطلبة وأولياء الأمور، ولا يتم مشاركة أي سجلات دراسية أو نتائج اختبارات مع أي جهات خارجية.
          </div>

          <div>
            <h4 className="font-bold text-[#0B3D5B] text-sm mb-2">1. حقوق الملكية الفكرية للمحتوى والمناهج:</h4>
            <p className="text-slate-600 leading-relaxed">
              جميع المناهج والمراجع والأدلة التوضيحية وتجارب المحاكاة الافتراضية المضمنة في منصة NEXORA تخضع لقوانين حماية حقوق الملكية الفكرية والتأليفية؛ حيث تعود حقوق المنصة الرقمية وأدواتها التفاعلية لمنصة NEXORA، بينما تعود حقوق المناهج والمصادر التعليمية لأصحابها ومؤلفيها الأصليين، ويُصرح بالاستفادة منها لأغراض التدريس والتعلم الشخصي غير التجاري.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-[#0B3D5B] text-sm mb-2">2. مبادرات ومشاركات المعلمين:</h4>
            <p className="text-slate-600 leading-relaxed">
              يحتفظ المعلم صاحب المبادرة بحقه الأدبي في نسبة العمل إليه، ويمنح المنصة ترخيصاً تعليمياً غير حصري لمشاركة كراسات الأنشطة وأوراق العمل مع زملائه المعلمين ضمن المجتمع المعرفي.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-[#0B3D5B] text-sm mb-2">3. أمان المختبرات الافتراضية والذكاء الاصطناعي:</h4>
            <p className="text-slate-600 leading-relaxed">
              تخضع استجابات المساعد الذكي لضوابط تربوية صارمة تضمن الدقة العلمية والحيادية والمطابقة للقيم التربوية والمعايير العلمية المتبعة.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500">تم التحديث في أكتوبر 2026</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-bold text-white bg-[#0B3D5B] hover:bg-[#072a3f] transition-colors"
          >
            موافق وإغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
