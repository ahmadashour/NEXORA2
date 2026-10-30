import React, { useState } from 'react';
import { X, Mail, Phone, MapPin, Send, CheckCircle2, MessageSquare } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('استفسار حول المختبرات الافتراضية');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden text-right"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-[#0B3D5B] text-white p-5 flex items-center justify-between border-b border-slate-700">
          <div>
            <span className="font-latin text-xs font-bold text-[#00A7B5] tracking-wider">NEXORA SUPPORT</span>
            <h3 className="text-base sm:text-lg font-bold">التواصل والدعم الفني والتربوي</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-cyan-100 text-[#00A7B5] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-800">تم تسجيل استفسارك بنجاح</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              تم التحقق من بيانات النموذج في الواجهة. خدمة الإرسال الفعلي للخادم البرمجي قيد التفعيل في المرحلة القادمة.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-3 px-4 py-1.5 text-xs font-semibold text-[#0B3D5B] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              العودة للنموذج
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل:</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أدخل اسمك الكريم"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني:</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">موضوع الاستفسار:</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5]"
              >
                <option value="استفسار حول المختبرات الافتراضية">استفسار حول المختبرات الافتراضية (NEXORA LAB)</option>
                <option value="اقتراح محتوى أو مبادرة تعليمية">اقتراح محتوى أو مبادرة تعليمية</option>
                <option value="دعم فني لحساب البوابة وصلاحيات الدخول">دعم فني لحساب البوابة وصلاحيات الدخول</option>
                <option value="استشارة تربوية ومنهجية تخصصية">استشارة تربوية ومنهجية تخصصية</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نص الرسالة أو الطلب:</label>
              <textarea
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب استفسارك أو مشكلتك الفنية بالتفصيل..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#0B3D5B] hover:bg-[#072a3f] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Send className="w-4 h-4 rotate-180" />
              <span>تسجيل وإرسال الاستفسار</span>
            </button>
          </form>
        )}

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>نموذج التواصل المباشر مع فريق التطوير المعرفي</span>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 font-semibold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
