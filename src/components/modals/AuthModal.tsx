import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, CheckCircle2, Server, WifiOff } from 'lucide-react';
import { PortalId, UserSession } from '../../types';
import { Toast, ToastType } from '../common/Toast';
import { apiClient } from '../../services/apiClient';

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
  const [email, setEmail] = useState('teacher@ashouracademy.com');
  const [password, setPassword] = useState('NEXORA2026!');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);

  const roles: { id: PortalId; title: string; desc: string }[] = [
    { id: 'lead', title: 'موجه فني للعلوم', desc: 'إشراف ومتابعة جودة التعليم' },
    { id: 'pro', title: 'رئيس قسم علمي', desc: 'إدارة القسم والمختبرات المدرسية' },
    { id: 'teach', title: 'معلم علوم', desc: 'تحضير الدروس والتقويم الصفي' },
    { id: 'start', title: 'معلم متدرب', desc: 'برامج التهيئة والمصاحبة المهنية' },
    { id: 'student', title: 'طالب', desc: 'المختبرات الافتراضية والتحديات' },
    { id: 'family', title: 'ولي أمر', desc: 'متابعة تقارير التحصيل والتواصل' },
  ];

  // Probe backend health when modal opens
  useEffect(() => {
    let isMounted = true;
    apiClient.checkHealth().then(res => {
      if (isMounted) {
        setIsBackendOnline(res.isOnline);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setToast(null);

    try {
      if (mode === 'register') {
        const result = await apiClient.register({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          role: selectedRole.id,
        });

        setIsLoading(false);
        setSuccessMsg(true);

        setTimeout(() => {
          onLoginSuccess({
            isLoggedIn: true,
            name: result.user?.full_name || fullName,
            role: result.user?.role_name || selectedRole.title,
            portalId: (result.user?.role_code?.toLowerCase() as PortalId) || selectedRole.id,
          });
          onClose();
        }, 600);

      } else {
        // Login mode
        try {
          const result = await apiClient.login({
            email: email.trim(),
            password,
          });

          setIsLoading(false);
          setSuccessMsg(true);

          setTimeout(() => {
            onLoginSuccess({
              isLoggedIn: true,
              name: result.user?.full_name || fullName,
              role: result.user?.role_name || selectedRole.title,
              portalId: (result.user?.role_code?.toLowerCase() as PortalId) || selectedRole.id,
            });
            onClose();
          }, 600);
        } catch (loginErr: unknown) {
          const errorMsg = loginErr instanceof Error ? loginErr.message : 'فشل تسجيل الدخول';
          
          // If the backend returned an explicit error (e.g. wrong password), show it!
          if (isBackendOnline) {
            setIsLoading(false);
            setToast({
              type: 'error',
              message: errorMsg,
            });
            return;
          }

          // Fallback to local demo session if backend is completely offline
          console.warn('[NEXORA] Backend offline, falling back to local demo session');
          setIsLoading(false);
          setSuccessMsg(true);
          setTimeout(() => {
            onLoginSuccess({
              isLoggedIn: true,
              name: fullName || 'مستخدم تجريبي',
              role: selectedRole.title,
              portalId: selectedRole.id,
            });
            onClose();
          }, 600);
        }
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الطلب';
      
      if (!isBackendOnline) {
        // Offline demo fallback
        setSuccessMsg(true);
        setTimeout(() => {
          onLoginSuccess({
            isLoggedIn: true,
            name: fullName || 'مستخدم المنظومة',
            role: selectedRole.title,
            portalId: selectedRole.id,
          });
          onClose();
        }, 600);
      } else {
        setToast({
          type: 'error',
          message: msg,
        });
      }
    }
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
            <div className="flex items-center gap-2">
              <span className="font-latin text-xs font-bold text-[#00A7B5] tracking-wider">NEXORA AUTH</span>
              {isBackendOnline !== null && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-sans ${
                  isBackendOnline ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {isBackendOnline ? <Server className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                  {isBackendOnline ? 'الخادم متصل' : 'وضع المعاينة'}
                </span>
              )}
            </div>
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
            onClick={() => { setMode('login'); setToast(null); }}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
              mode === 'login' 
                ? 'border-[#00A7B5] text-[#0B3D5B] bg-white' 
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => { setMode('register'); setToast(null); }}
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
              <span>تمت المصادقة بنجاح! جاري توجيهك إلى بوابتك التعليمية...</span>
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

          {/* Email or Username */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              البريد الإلكتروني:
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@ashouracademy.com"
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
                      setToast({ type: 'info', message: `تم تسجيل طلب استعادة كلمة المرور لحساب (${email}). تنبيه: خدمة الإرسال الآلي للبريد قيد التفعيل مع إعداد SMTP في Hostinger.` });
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
            className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#0B3D5B] hover:bg-[#072a3f] transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer mt-4 disabled:opacity-70"
          >
            {isLoading ? (
              <span>جاري التحقق عبر واجهة البرمجة v1...</span>
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
