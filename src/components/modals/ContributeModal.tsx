import React, { useState } from 'react';
import { X, CheckCircle2, UploadCloud, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { communityService, ApiError } from '../../services/communityService';
import { Toast, ToastType } from '../common/Toast';

interface ContributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostSubmitted?: () => void;
}

export const ContributeModal: React.FC<ContributeModalProps> = ({
  isOpen,
  onClose,
  onPostSubmitted
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('كيمياء');
  const [grade, setGrade] = useState('الصف العاشر');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle || !trimmedContent) {
      setToast({ type: 'warning', message: 'يرجى استيفاء العنوان وتفاصيل خطوات التطبيق' });
      return;
    }

    setIsSubmitting(true);
    setToast(null);

    try {
      const newPost = await communityService.createPost({
        title: trimmedTitle,
        content: trimmedContent,
        subject,
        grade,
        summary: summary.trim() || undefined,
        tags: [subject, grade],
      });

      // Dispatch cross-component event so CommunitySection immediately updates
      window.dispatchEvent(new CustomEvent('nexora:post-created', { detail: newPost }));

      setSubmitted(true);
      setTimeout(() => {
        if (onPostSubmitted) onPostSubmitted();
        // Reset form after successful submission
        setTitle('');
        setSummary('');
        setContent('');
        setSubmitted(false);
        onClose();
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setToast({
            type: 'warning',
            message: 'يرجى تسجيل الدخول أولاً لتتمكن من نشر مبادرتك في المجتمع المعرفي.',
          });
        } else if (err.status === 403) {
          setToast({
            type: 'error',
            message: 'حسابك الحالي لا يمتلك صلاحية نشر المشاركات (مخصص لحسابات المعلمين والمشرفين).',
          });
        } else if (err.status === 422 && Array.isArray(err.details)) {
          const detailMsgs = err.details.map((d: any) => d.message || d.field).join('، ');
          setToast({
            type: 'error',
            message: `فشل التحقق من صحة المدخلات: ${detailMsgs}`,
          });
        } else {
          setToast({
            type: 'error',
            message: err.message || 'تعذر نشر المشاركة على الخادم',
          });
        }
      } else {
        setToast({
          type: 'error',
          message: 'حدث خطأ في الاتصال أثناء نشر المبادرة. تم حفظ مدخلاتك لإعادة المحاولة.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden text-right"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-[#2E9E6F] text-white p-5 flex items-center justify-between border-b border-emerald-700">
          <div>
            <span className="text-xs font-semibold text-emerald-100 block">مجتمع NEXORA المعرفي</span>
            <h3 className="text-base sm:text-lg font-bold">مشاركة مبادرة أو ورقة عمل علمية</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-black/15 hover:bg-black/25 text-white transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Container */}
        {toast && (
          <div className="p-4 pb-0">
            <Toast
              type={toast.type}
              message={toast.message}
              onClose={() => setToast(null)}
            />
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs sm:text-sm">
          {submitted ? (
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-800">تم استلام ونشر مشاركتك بنجاح!</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                تم اعتماد المبادرة وتوثيقها على الخادم في المجتمع المعرفي لإثراء الرصيد التشاركي للمعلمين.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان المبادرة أو التجربة المعملية:
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  disabled={isSubmitting}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: استراتيجية تفاعلية لتدريس الروابط التساهمية بالمحاكاة"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#2E9E6F] disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المادة التخصصية:
                  </label>
                  <select
                    value={subject}
                    disabled={isSubmitting}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#2E9E6F] disabled:opacity-60"
                  >
                    <option value="كيمياء">كيمياء</option>
                    <option value="فيزياء">فيزياء</option>
                    <option value="أحياء">أحياء</option>
                    <option value="جيولوجيا">جيولوجيا</option>
                    <option value="علوم عامة">علوم عامة</option>
                    <option value="طرق تدريس">طرق تدريس وSTEM</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المرحلة الدراسية:
                  </label>
                  <select
                    value={grade}
                    disabled={isSubmitting}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#2E9E6F] disabled:opacity-60"
                  >
                    <option value="المرحلة المتوسطة">المرحلة المتوسطة</option>
                    <option value="الصف العاشر">الصف العاشر</option>
                    <option value="الصف الحادي عشر">الصف الحادي عشر</option>
                    <option value="الصف الثاني عشر">الصف الثاني عشر</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملخص مختصر للأثر التعليمي:
                </label>
                <textarea
                  required
                  rows={2}
                  value={summary}
                  disabled={isSubmitting}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="سطران يوضحان كيف ساعد هذا النشاط الطلاب في المختبر أو الصف..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#2E9E6F] disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  خطوات التنفيذ والأدوات المستخدمة:
                </label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  disabled={isSubmitting}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="اكتب بالتفصيل خطوات التجربة، متطلبات السلامة، وطريقة التقويم..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#2E9E6F] disabled:opacity-60"
                />
              </div>

              {/* Simulated File Attachment */}
              <div 
                onClick={() => setToast({ type: 'info', message: 'خاصية رفع المرفقات ستكون متاحة قريباً عبر خدمة التخزين السحابية المعتمدة.' })}
                className="p-3 border-2 border-dashed border-slate-300 rounded-xl text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                <span className="text-xs font-medium text-slate-600 block">إرفاق كراسة النشاط أو ملف العرض (PDF, Word, PPTX)</span>
                <span className="text-[10px] text-slate-400">الحد الأقصى 25 ميجابايت (تجريبي)</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#2E9E6F] hover:bg-[#25835b] disabled:opacity-60 transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التحقق والتوثيق على الخادم...</span>
                  </>
                ) : (
                  <>
                    <span>إرسال المبادرة ونشرها في المجتمع</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
