import React, { useState } from 'react';
import { Users, Heart, Bookmark, ArrowLeft, PlusCircle, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { CommunityPost } from '../types';
import { useCommunity } from '../hooks/useCommunity';
import { Toast, ToastType } from './common/Toast';

interface CommunitySectionProps {
  onSelectPost: (post: CommunityPost) => void;
  onOpenContribute: () => void;
}

export const CommunitySection: React.FC<CommunitySectionProps> = ({
  onSelectPost,
  onOpenContribute
}) => {
  const [commImgError, setCommImgError] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const communityImage = '/src/assets/images/teacher_community_stem_1793340699973.jpg';

  const {
    posts,
    pagination,
    isLoading,
    error,
    likedMap,
    savedMap,
    likesCountMap,
    savesCountMap,
    actionInProgress,
    loadPosts,
    toggleLike,
    toggleSave,
  } = useCommunity({ autoFetch: true, limit: 6 });

  const handleToggleLike = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    const res = await toggleLike(postId);
    if (!res.success && res.message) {
      setToast({
        type: res.requiresAuth ? 'warning' : 'error',
        message: res.message,
      });
    }
  };

  const handleToggleSave = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    const res = await toggleSave(postId);
    if (!res.success && res.message) {
      setToast({
        type: res.requiresAuth ? 'warning' : 'error',
        message: res.message,
      });
    }
  };

  return (
    <section id="community" className="py-16 lg:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Toast Notification */}
        {toast && (
          <div className="mb-6">
            <Toast
              type={toast.type}
              message={toast.message}
              onClose={() => setToast(null)}
            />
          </div>
        )}

        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 text-right">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#00A7B5] mb-2 tracking-wide">
              <span>المجتمع المعرفي</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-500 font-normal">تجارب ومبادرات معلمي العلوم الميدانية</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B3D5B] tracking-tight">
              مشاركات المعلمين المتميزة
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenContribute}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#2E9E6F] hover:bg-[#25835b] transition-colors shadow-xs cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2E9E6F]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>شارك مبادرتك التربوية</span>
            </button>
          </div>
        </div>

        {/* Community Grid + Visual Spotlight */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Spotlight Visual & Context Card (Left 4 cols) */}
          <div className="lg:col-span-4 bg-[#F8FAFC] rounded-2xl border border-slate-200 p-6 flex flex-col justify-between text-right">
            <div>
              <div className="relative rounded-xl overflow-hidden mb-5 aspect-4/3 bg-slate-900 border border-slate-200/80 group">
                {!commImgError ? (
                  <img
                    src={communityImage}
                    alt="مجتمع معلمي العلوم في ورشة تطوير المناهج"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                    referrerPolicy="no-referrer"
                    onError={() => setCommImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800 text-[#00A7B5]">
                    <Users className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B3D5B]/80 via-transparent to-transparent flex items-end p-4">
                  <span className="text-xs text-white font-medium">ورش عمل تبادل الخبرات والتجارب المخبرية</span>
                </div>
              </div>

              <h3 className="text-lg font-bold text-[#0B3D5B] mb-2">
                بيئة تشاركية لتبادل أفضل الممارسات
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                انضم إلى أكثر من 3,400 معلم ورئيس قسم يشاركون تحضيراتهم، كراسات أنشطتهم المعملية، ونماذج التقييم التخصصية لرفع مستوى تعليم العلوم.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
              <span>مبادرات معتمدة: <strong className="text-slate-800 font-bold">{pagination?.total ?? posts.length}</strong></span>
              <span className="text-[#2E9E6F] font-semibold">مراجعة وتقييم تربوي</span>
            </div>
          </div>

          {/* Teacher Posts Cards (Right 8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Loading State Skeleton */}
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between animate-pulse"
                  >
                    <div>
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3 bg-slate-200 rounded w-1/2" />
                          <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                        </div>
                      </div>
                      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                      <div className="space-y-1 mb-4">
                        <div className="h-3 bg-slate-100 rounded w-full" />
                        <div className="h-3 bg-slate-100 rounded w-5/6" />
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="h-3 bg-slate-200 rounded w-16" />
                      <div className="h-3 bg-slate-200 rounded w-20" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error State */}
            {!isLoading && error && (
              <div className="bg-red-50/80 border border-red-200 rounded-2xl p-8 text-center space-y-4">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-red-900">تعذر تحميل مشاركات المجتمع</h4>
                  <p className="text-xs text-red-600">{error}</p>
                </div>
                <button
                  onClick={() => loadPosts(1)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0B3D5B] hover:bg-[#072a3f] transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && posts.length === 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center space-y-4">
                <Users className="w-12 h-12 text-slate-400 mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-800">لا توجد مشاركات منشورة حالياً</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    كن أول من يشارك تجاربه ومبادراته التعليمية مع زملائه المعلمين في المجتمع التربوي.
                  </p>
                </div>
                <button
                  onClick={onOpenContribute}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#2E9E6F] hover:bg-[#25835b] transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>إضافة مبادرة جديدة</span>
                </button>
              </div>
            )}

            {/* Posts Grid */}
            {!isLoading && !error && posts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {posts.map((post) => {
                  const isLiked = !!likedMap[post.id];
                  const isSaved = !!savedMap[post.id];
                  const currentLikes = likesCountMap[post.id] ?? post.likes;
                  const currentSaves = savesCountMap[post.id] ?? post.saves;
                  const isLikeLoading = !!actionInProgress[`like:${post.id}`];
                  const isSaveLoading = !!actionInProgress[`save:${post.id}`];

                  return (
                    <div
                      key={post.id}
                      onClick={() => onSelectPost(post)}
                      className="bg-white rounded-xl border border-slate-200 hover:border-[#00A7B5]/40 hover:shadow-md transition-all p-5 flex flex-col justify-between group cursor-pointer text-right"
                    >
                      <div>
                        {/* Author Meta */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-[#0B3D5B]/10 text-[#0B3D5B] font-bold text-xs flex items-center justify-center shrink-0">
                              {post.author.name.charAt(2) || 'م'}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#00A7B5] transition-colors leading-tight">
                                {post.author.name}
                              </h4>
                              <span className="text-[11px] text-slate-500 block leading-tight">
                                {post.author.role} · {post.author.school}
                              </span>
                            </div>
                          </div>

                          <span className="text-[11px] text-[#00A7B5] font-semibold bg-[#00A7B5]/10 px-2 py-0.5 rounded">
                            {post.subject}
                          </span>
                        </div>

                        {/* Post Title */}
                        <h3 className="text-sm font-bold text-[#0B3D5B] group-hover:text-[#00A7B5] transition-colors leading-snug mb-2 line-clamp-2">
                          {post.title}
                        </h3>

                        {/* Summary */}
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-4">
                          {post.summary}
                        </p>
                      </div>

                      {/* Card Interactions & Read More */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <button
                            type="button"
                            disabled={isLikeLoading}
                            onClick={(e) => handleToggleLike(e, post.id)}
                            className={`flex items-center gap-1 hover:text-red-500 transition-colors cursor-pointer ${
                              isLiked ? 'text-red-500 font-bold' : ''
                            } ${isLikeLoading ? 'opacity-50' : ''}`}
                            title="إعجاب"
                          >
                            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                            <span>{currentLikes}</span>
                          </button>

                          <button
                            type="button"
                            disabled={isSaveLoading}
                            onClick={(e) => handleToggleSave(e, post.id)}
                            className={`flex items-center gap-1 hover:text-[#00A7B5] transition-colors cursor-pointer ${
                              isSaved ? 'text-[#00A7B5] font-bold' : ''
                            } ${isSaveLoading ? 'opacity-50' : ''}`}
                            title="حفظ في المفضلة"
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                            <span>{currentSaves}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1 text-xs font-semibold text-[#0B3D5B] group-hover:text-[#00A7B5] transition-colors">
                          <span>قراءة المبادرة</span>
                          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs text-slate-600">
                <button
                  type="button"
                  disabled={pagination.page <= 1 || isLoading}
                  onClick={() => loadPosts(pagination.page - 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>السابق</span>
                </button>

                <span>
                  الصفحة {pagination.page} من {pagination.totalPages}
                </span>

                <button
                  type="button"
                  disabled={!pagination.hasMore || isLoading}
                  onClick={() => loadPosts(pagination.page + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <span>التالي</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

          </div>

        </div>

      </div>
    </section>
  );
};
