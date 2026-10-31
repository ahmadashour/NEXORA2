import React, { useState, useEffect, useCallback } from 'react';
import { X, Heart, Bookmark, UserCheck, MessageSquare, Download, Trash2, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { CommunityPost } from '../../types';
import { AdaptedComment } from '../../types/contracts';
import { communityService, ApiError } from '../../services/communityService';
import { apiClient } from '../../services/apiClient';
import { Toast, ToastType } from '../common/Toast';

interface PostDetailModalProps {
  post: CommunityPost | null;
  onClose: () => void;
  onPostDeleted?: (postId: string) => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({ post, onClose, onPostDeleted }) => {
  if (!post) return null;

  // Interaction state
  const [liked, setLiked] = useState<boolean>(Boolean(post.isLiked));
  const [likesCount, setLikesCount] = useState<number>(post.likes);
  const [saved, setSaved] = useState<boolean>(Boolean(post.isSaved));
  const [savesCount, setSavesCount] = useState<number>(post.saves);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Comments state
  const [comments, setComments] = useState<AdaptedComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Post management state
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  // Check current session to display author management actions
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    let isMounted = true;
    apiClient.getMe()
      .then((res: any) => {
        if (!isMounted) return;
        const user = res.user;
        if (user) {
          setCurrentUserId(user.id);
          const isAdmin = ['LEAD', 'PRO'].includes((user.role_code || '').toUpperCase());
          const isAuthor = post.authorId && post.authorId === user.id;
          setCanDelete(Boolean(isAdmin || isAuthor));
        }
      })
      .catch(() => {
        if (isMounted) {
          setCurrentUserId(null);
          setCanDelete(false);
        }
      });
    return () => { isMounted = false; };
  }, [post.authorId]);

  // Load real comments from API
  const loadComments = useCallback(async () => {
    setIsLoadingComments(true);
    setCommentsError(null);
    try {
      const realComments = await communityService.getComments(post.id);
      setComments(realComments);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'تعذر تحميل التعليقات من الخادم';
      setCommentsError(msg);
    } finally {
      setIsLoadingComments(false);
    }
  }, [post.id]);

  useEffect(() => {
    setLiked(Boolean(post.isLiked));
    setLikesCount(post.likes);
    setSaved(Boolean(post.isSaved));
    setSavesCount(post.saves);
    loadComments();
  }, [post.id, post.isLiked, post.isSaved, post.likes, post.saves, loadComments]);

  // Add Comment handler
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const newComment = await communityService.addComment(post.id, trimmed);
      // Strictly append only upon confirmed 201 server response
      setComments(prev => [...prev, newComment]);
      setCommentText('');
      setToast({ type: 'success', message: 'تمت إضافة تعليقك بنجاح' });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        setToast({ type: 'warning', message: 'يرجى تسجيل الدخول أولاً لإضافة تعليق مهني' });
      } else {
        const msg = err instanceof ApiError ? err.message : 'فشل إرسال التعليق إلى الخادم';
        setToast({ type: 'error', message: msg });
      }
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Like Toggle
  const handleToggleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    try {
      const res = await communityService.toggleLike(post.id, liked);
      setLiked(res.liked);
      setLikesCount(res.likesCount);
      window.dispatchEvent(new CustomEvent('nexora:post-interaction', {
        detail: { id: post.id, isLiked: res.liked, likesCount: res.likesCount }
      }));
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        setToast({ type: 'warning', message: 'يرجى تسجيل الدخول لتسجيل الإعجاب' });
      } else {
        const msg = err instanceof ApiError ? err.message : 'تعذر تحديث الإعجاب';
        setToast({ type: 'error', message: msg });
      }
    } finally {
      setIsLiking(false);
    }
  };

  // Save Toggle
  const handleToggleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await communityService.toggleBookmark(post.id, saved);
      setSaved(res.bookmarked);
      setSavesCount(res.bookmarksCount);
      window.dispatchEvent(new CustomEvent('nexora:post-interaction', {
        detail: { id: post.id, isSaved: res.bookmarked, savesCount: res.bookmarksCount }
      }));
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        setToast({ type: 'warning', message: 'يرجى تسجيل الدخول لحفظ المشاركة في المفضلة' });
      } else {
        const msg = err instanceof ApiError ? err.message : 'تعذر حفظ المشاركة';
        setToast({ type: 'error', message: msg });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Post
  const handleDeletePost = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await communityService.deletePost(post.id);
      window.dispatchEvent(new CustomEvent('nexora:post-deleted', { detail: { id: post.id } }));
      if (onPostDeleted) onPostDeleted(post.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'تعذر أرشفة المنشور';
      setToast({ type: 'error', message: msg });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
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

          <div className="flex items-center gap-2">
            {canDelete && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 transition-colors cursor-pointer"
                title="أرشفة / حذف المنشور"
                aria-label="حذف"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Delete Confirmation Bar */}
        {showDeleteConfirm && (
          <div className="bg-red-50 p-3.5 border-b border-red-200 flex items-center justify-between text-xs text-red-800">
            <span>هل أنت متأكد من رغبتك في أرشفة هذا المنشور؟</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeletePost}
                className="px-3 py-1 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'جاري الأرشفة...' : 'نعم، أرشف'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-xs sm:text-sm leading-relaxed">
          
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

          {/* Author Badge */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00A7B5] text-white font-bold text-sm flex items-center justify-center">
                {post.author.name.charAt(2) || 'م'}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{post.author.name}</h4>
                <p className="text-[11px] text-slate-500">
                  {post.author.role} · {post.author.school}
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

          {/* Attachments Section */}
          {post.fileType && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 text-xs block">المرفقات التعليمية الجاهزة للتحميل</span>
                <span className="text-[11px] text-slate-500">{post.fileType} · ملفات تعليمية مصاحبة</span>
              </div>

              <button
                type="button"
                onClick={() => setToast({ type: 'info', message: 'الملفات المرفقة غير متوفرة للتنزيل الفعلي حالياً — متاح الاطلاع على الخطوات والملخص لحين ربط خدمة التخزين السحابية.' })}
                className="px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-[#2E9E6F] hover:bg-[#25835b] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل المرفقات</span>
              </button>
            </div>
          )}

          {/* Comments Discussion */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-[#00A7B5]" />
                <span>ملاحظات ونقاشات الزملاء المعلمين ({comments.length}):</span>
              </h4>
              {isLoadingComments && (
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>تحديث التعليقات...</span>
                </div>
              )}
            </div>

            {/* Comments List */}
            {isLoadingComments && comments.length === 0 ? (
              <div className="space-y-2">
                {[1, 2].map(n => (
                  <div key={n} className="p-3 bg-slate-50 rounded-lg animate-pulse h-12" />
                ))}
              </div>
            ) : commentsError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-center justify-between">
                <span>{commentsError}</span>
                <button
                  type="button"
                  onClick={loadComments}
                  className="inline-flex items-center gap-1 font-bold text-red-700 hover:underline cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            ) : comments.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 border border-slate-100">
                لا توجد تعليقات حتى الآن. شارك زميلك المعلم برأيك المهني وتجربتك.
              </div>
            ) : (
              <div className="space-y-2.5">
                {comments.map((c) => (
                  <div key={c.id} className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-200/80 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800">{c.author.name} · <span className="text-slate-500 font-normal">{c.author.role}</span></span>
                      <span className="text-slate-400">{c.createdAt}</span>
                    </div>
                    <p className="leading-relaxed">{c.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add Comment Form */}
            <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
              <input
                type="text"
                value={commentText}
                disabled={isSubmittingComment}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="أضف تعقيباً مهنياً أو استفساراً..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5] text-right disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || isSubmittingComment}
                className="px-4 py-2 bg-[#0B3D5B] text-white text-xs font-bold rounded-lg hover:bg-[#072a3f] disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isSubmittingComment ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>إرسال...</span>
                  </>
                ) : (
                  <span>إرسال</span>
                )}
              </button>
            </form>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isLiking}
              onClick={handleToggleLike}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                liked ? 'text-red-600 bg-red-50 border-red-200' : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-100'
              } ${isLiking ? 'opacity-50' : ''}`}
            >
              <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
              <span>{likesCount} إعجاب</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleToggleSave}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                saved ? 'text-[#00A7B5] bg-cyan-50 border-cyan-200' : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-100'
              } ${isSaving ? 'opacity-50' : ''}`}
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
