import React, { useState } from 'react';
import { X, Lock, Mail, User, Shield, CheckCircle2, ArrowLeft, KeyRound } from 'lucide-react';
import { PortalId, UserSession } from '../../types';
import { Toast, ToastType } from '../common/Toast';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onLoginSuccess: (session: UserSession) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onLoginSuccess
}) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [selectedRole, setSelectedRole] = useState<{ id: PortalId; title: string }>({
    id: 'teach',
    title: 'معلم علوم'
  });
  const [fullName, setFullName] = useState('أ. أحمد عاشور');
  const [email, setEmail] = useState('teacher@example.com');
  const [password, setPassword] = useState('••••••••••••');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  const roles: { id: PortalId; title: string; desc: string }[] = [
    { id: 'lead', title: 'موجه فني للعلوم', desc: 'إشراف ومتابعة جودة التعليم' },
    { id: 'pro', title: 'رئيس قسم علمي', desc: 'إدارة القسم والمختبرات المدرسية' },
    { id: 'teach', title: 'معلم علوم', desc: 'تحضير الدروس والتقويم الصفي' },
    { id: 'start', title: 'معلم متدرب', desc: 'برامج التهيئة والمصاحبة المهنية' },
    { id: 'student', title: 'طالب', desc: 'المختبرات الافتراضية والتحديات' },
    { id: 'family', title: 'ولي أمر', desc: 'متابعة تقارير التحصيل والتواصل' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setSuccessMsg(true);

      setTimeout(() => {
        onLoginSuccess({
          isLoggedIn: true,
          name: fullName || 'مستخدم المنظومة',
          role: selectedRole.title,
          portalId: selectedRole.id
        });
        onClose();
      }, 700);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-right"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-[#0B3D5B] text-white p-5 flex items-center justify-between border-b border-slate-700">
          <div>
            <span className="font-latin text-xs font-bold text-[#00A7B5] tracking-wider">NEXORA AUTH</span>
            <h3 className="text-lg font-bold">
              {mode === 'login' ? 'تسجيل الدخول للمنظومة' : 'إنشاء حساب جديد في NEXORA'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
              mode === 'login' 
                ? 'border-[#00A7B5] text-[#0B3D5B] bg-white' 
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
              mode === 'register' 
                ? 'border-[#00A7B5] text-[#0B3D5B] bg-white' 
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            إنشاء حساب جديد
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>تمت المصادقة بنجاح! جاري تحويلك إلى بوابتك...</span>
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              صفة المستخدم (بوابة الدخول):
            </label>
            <select
              value={selectedRole.id}
              onChange={(e) => {
                const found = roles.find(r => r.id === e.target.value);
                if (found) setSelectedRole({ id: found.id, title: found.title });
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5]"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} — {r.desc}
                </option>
              ))}
            </select>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الاسم الكامل الثلاثي:
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="أدخل اسمك الثلاثي"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5]"
                />
              </div>
            </div>
          )}

          {/* Toast Notification Container */}
          {toast && (
            <div className="mb-2">
              <Toast
                type={toast.type}
                message={toast.message}
                onClose={() => setToast(null)}
              />
            </div>
          )}

          {/* Email or Username */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              البريد الإلكتروني أو اسم المستخدم:
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com أو اسم المستخدم"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5]"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                كلمة المرور:
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    if (!email.trim()) {
                      setToast({ type: 'warning', message: 'يرجى إدخال البريد الإلكتروني في الحقل أعلاه لاستلام رابط الاستعادة.' });
                    } else {
                      setToast({ type: 'info', message: `تم إرسال رابط إعادة تعيين كلمة المرور إلى البريد الإلكتروني المسجل (${email}).` });
                    }
                  }}
                  className="text-[11px] text-[#00A7B5] hover:underline cursor-pointer bg-transparent border-none p-0"
                >
                  نسيت كلمة المرور؟
                </button>
              )}
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5]"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#0B3D5B] hover:bg-[#072a3f] transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {isLoading ? (
              <span>جاري التحقق من البيانات...</span>
            ) : (
              <>
                <span>{mode === 'login' ? 'دخول المنصة' : 'تسجيل حساب جديد'}</span>
                <ArrowLeft className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500">
          تسجيل الدخول يمنحك وصولاً مباشراً ومزامناً لخدمات بوابة دورك في منصة NEXORA.
        </div>
      </div>
    </div>
  );
};
