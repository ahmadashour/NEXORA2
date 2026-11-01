import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  History,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { UserSession } from '../../types';
import { useSupport } from '../../hooks/useSupport';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  userSession?: UserSession;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose, userSession }) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('استفسار حول المختبرات الافتراضية');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState('');

  const {
    inquiries,
    loading: inquiriesLoading,
    error: inquiriesError,
    isSubmitting,
    actionError,
    submitInquiry,
    fetchInquiries,
  } = useSupport();

  // Pre-fill user data if logged in
  useEffect(() => {
    if (userSession?.isLoggedIn && userSession.name) {
      setName(userSession.name);
    }
  }, [userSession]);

  // Load inquiries history when switching to history tab
  useEffect(() => {
    if (activeTab === 'history' && userSession?.isLoggedIn) {
      fetchInquiries();
    }
  }, [activeTab, userSession?.isLoggedIn, fetchInquiries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const portalCode = userSession?.portalId ? userSession.portalId.toUpperCase() : undefined;
    const res = await submitInquiry({
      name,
      email,
      subject,
      message,
      portalCode,
    });

    if (res.success) {
      setSubmitted(true);
      setSubmittedMessage(res.message);
      // Clear inputs only on confirmed server success
      setMessage('');
    }
    // Note: On failure, inputs are strictly retained!
  };

  const handleResetForm = () => {
    setSubmitted(false);
    setSubmittedMessage('');
  };

  const isLoggedIn = !!userSession?.isLoggedIn;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right"
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

        {/* Tab Selector (only visible if user is logged in to access history) */}
        {isLoggedIn && (
          <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2">
            <button
              onClick={() => setActiveTab('new')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'new'
                  ? 'border-[#00A7B5] text-[#0B3D5B]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>إرسال استفسار جديد</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'border-[#00A7B5] text-[#0B3D5B]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>سجل استفساراتي</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'new' ? (
            submitted ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-800">تم استلام استفسارك بنجاح</h4>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                  {submittedMessage || 'تم تسجيل استفسارك في قاعدة بيانات الدعم الفني، وسيتواصل معك الفريق المختص قريباً.'}
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    onClick={handleResetForm}
                    className="px-4 py-2 text-xs font-semibold text-[#0B3D5B] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    إرسال استفسار آخر
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0B3D5B] hover:bg-[#072a3f] rounded-lg transition-colors cursor-pointer"
                  >
                    إغلاق النافذة
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
                {/* Error Banner */}
                {actionError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل:</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="أدخل اسمك الكريم"
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">موضوع الاستفسار:</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={isSubmitting}
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
                    placeholder="اكتب استفسارك أو مشكلتك الفنية بالتفصيل (5 أحرف على الأقل)..."
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                    isSubmitting
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-[#0B3D5B] hover:bg-[#072a3f]'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري إرسال الاستفسار...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 rotate-180" />
                      <span>تسجيل وإرسال الاستفسار</span>
                    </>
                  )}
                </button>
              </form>
            )
          ) : (
            /* History Tab */
            <div className="space-y-4">
              {inquiriesLoading && (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-4 h-24" />
                  ))}
                </div>
              )}

              {!inquiriesLoading && inquiriesError && (
                <div className="bg-white rounded-xl border border-red-200 p-6 text-center shadow-xs">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800 mb-1">تعذر استرجاع الاستفسارات</h4>
                  <p className="text-xs text-slate-600 mb-3">{inquiriesError}</p>
                  <button
                    onClick={() => fetchInquiries()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B3D5B] text-white rounded-lg text-xs font-semibold hover:bg-[#072a3f] transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>إعادة المحاولة</span>
                  </button>
                </div>
              )}

              {!inquiriesLoading && !inquiriesError && inquiries.length === 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
                  <History className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800 mb-1">لا توجد استفسارات سابقة</h4>
                  <p className="text-xs text-slate-500">لم تقم بإرسال أي طلبات دعم بعد من هذا الحساب.</p>
                </div>
              )}

              {!inquiriesLoading && !inquiriesError && inquiries.length > 0 && (
                <div className="space-y-3">
                  {inquiries.map((inq) => (
                    <div
                      key={inq.id}
                      className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 text-xs space-y-2 hover:border-[#00A7B5]/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800 text-xs sm:text-sm line-clamp-1">
                          {inq.subject}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${inq.statusColor}`}>
                          {inq.statusArabic}
                        </span>
                      </div>
                      <p className="text-slate-600 leading-relaxed line-clamp-2">
                        {inq.message}
                      </p>
                      {inq.adminNotes && (
                        <div className="p-2 bg-amber-50/80 border border-amber-200 rounded-lg text-amber-900 text-[11px]">
                          <strong>رد فريق الدعم:</strong> {inq.adminNotes}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{inq.date}</span>
                        </span>
                        {inq.portalCode && (
                          <span className="font-latin text-[10px] bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded">
                            {inq.portalCode}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>نموذج التواصل المباشر مع فريق التطوير المعرفي</span>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
