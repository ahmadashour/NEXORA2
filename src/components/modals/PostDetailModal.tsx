import React, { useState } from 'react';
import { X, Heart, Bookmark, FileText, CheckCircle2, Download, UserCheck, MessageSquare, Share2 } from 'lucide-react';
import { CommunityPost } from '../../types';
import { Toast, ToastType } from '../common/Toast';

interface PostDetailModalProps {
  post: CommunityPost | null;
  onClose: () => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({ post, onClose }) => {
  if (!post) return null;

  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [comments, setComments] = useState<string[]>([
    'مبادرة متميزة ومفيدة جداً، قمت بتطبيقها اليوم في مختبر الأحياء وكانت استجابة الطالبات ممتازة.',
    'شكراً أستاذتنا الفاضلة على هذا الإثراء العلمي والتنظيم الدقيق.'
  ]);

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setComments([...comments, commentText.trim()]);
    setCommentText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 bg-[#0B3D5B] text-white flex items-center justify-between border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2 text-xs text-white/80 mb-1">
              <span className="font-semibold text-[#00A7B5]">{post.subject}</span>
              <span>·</span>
              <span>{post.grade}</span>
              <span>·</span>
              <span className="text-white/60">{post.publishedDate}</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold leading-snug">{post.title}</h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-xs sm:text-sm leading-relaxed">
          
          {/* Author Badge */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00A7B5] text-white font-bold text-sm flex items-center justify-center">
                {post.author.name.charAt(2) || 'م'}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{post.author.name}</h4>
                <p className="text-[11px] text-slate-500">
                  {post.author.role} · {post.author.school} ({post.author.district})
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              <UserCheck className="w-3.5 h-3.5" />
              <span>معلم موثق</span>
            </div>
          </div>

          {/* Post Summary */}
          <div>
            <h4 className="font-bold text-[#0B3D5B] text-xs mb-1.5">ملخص المبادرة والأثر الميداني:</h4>
            <p className="p-3 bg-cyan-50/50 rounded-xl border border-cyan-100 text-slate-700 leading-relaxed">
              {post.summary}
            </p>
          </div>

          {/* Full Content */}
          <div>
            <h4 className="font-bold text-[#0B3D5B] text-xs mb-2">تفاصيل وخطوات التطبيق:</h4>
            <div className="whitespace-pre-line text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-slate-200">
              {post.content}
            </div>
          </div>

          {/* Toast Notification Container */}
          {toast && (
            <div className="mb-4">
              <Toast
                type={toast.type}
                message={toast.message}
                onClose={() => setToast(null)}
              />
            </div>
          )}

          {/* Attachments Section */}
          {post.fileType && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 text-xs block">المرفقات التعليمية الجاهزة للتحميل</span>
                <span className="text-[11px] text-slate-500">{post.fileType} · {post.attachmentsCount || 1} ملفات مصاحبة</span>
              </div>

              <button
                type="button"
                onClick={() => setToast({ type: 'success', message: 'جاري تنزيل الملفات والحقائب المصاحبة للمبادرة بنجاح.' })}
                className="px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-[#2E9E6F] hover:bg-[#25835b] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل المرفقات</span>
              </button>
            </div>
          )}

          {/* Comments Discussion */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-[#00A7B5]" />
              <span>ملاحظات ونقاشات الزملاء المعلمين ({comments.length}):</span>
            </h4>

            <div className="space-y-2">
              {comments.map((c, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 border border-slate-100">
                  {c}
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="أضف تعقيباً مهنياً أو استفساراً..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5] text-right"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="px-4 py-2 bg-[#0B3D5B] text-white text-xs font-bold rounded-lg hover:bg-[#072a3f] disabled:opacity-50 transition-colors cursor-pointer"
              >
                إرسال
              </button>
            </form>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLiked(!liked)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                liked ? 'text-red-600 bg-red-50 border-red-200' : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
              <span>{post.likes + (liked ? 1 : 0)} إعجاب</span>
            </button>

            <button
              onClick={() => setSaved(!saved)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                saved ? 'text-[#00A7B5] bg-cyan-50 border-cyan-200' : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-current' : ''}`} />
              <span>{saved ? 'محفوظ' : 'حفظ في ملفي'}</span>
            </button>
          </div>

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
