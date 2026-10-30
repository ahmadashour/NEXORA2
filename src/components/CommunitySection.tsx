import React, { useState } from 'react';
import { Users, Heart, Bookmark, FileText, ArrowLeft, Share2, PlusCircle, Check } from 'lucide-react';
import { COMMUNITY_POSTS } from '../data/mockData';
import { CommunityPost } from '../types';

interface CommunitySectionProps {
  onSelectPost: (post: CommunityPost) => void;
  onOpenContribute: () => void;
}

export const CommunitySection: React.FC<CommunitySectionProps> = ({
  onSelectPost,
  onOpenContribute
}) => {
  const [commImgError, setCommImgError] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});
  const communityImage = '/src/assets/images/teacher_community_stem_1793340699973.jpg';

  const toggleLike = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setLikedPosts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSave = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSavedPosts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section id="community" className="py-16 lg:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
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
                انضم إلى أكثر من 3,400 معلم ورئيس قسم يشاركون تحضيراتهم، كراسات أنشطتهم المعملية، ونماذج التقييم المعتمدة لرفع مستوى تعليم العلوم.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
              <span>مبادرات مجازة هذا الشهر: <strong className="text-slate-800 font-bold">142</strong></span>
              <span className="text-[#2E9E6F] font-semibold">تحكيم إشرافي معتمد</span>
            </div>
          </div>

          {/* Teacher Posts Cards (Right 8 cols) */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {COMMUNITY_POSTS.map((post) => {
              const isLiked = !!likedPosts[post.id];
              const isSaved = !!savedPosts[post.id];
              const currentLikes = post.likes + (isLiked ? 1 : 0);

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
                        onClick={(e) => toggleLike(e, post.id)}
                        className={`flex items-center gap-1 hover:text-red-500 transition-colors ${isLiked ? 'text-red-500 font-bold' : ''}`}
                        title="إعجاب"
                      >
                        <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                        <span>{currentLikes}</span>
                      </button>

                      <button
                        onClick={(e) => toggleSave(e, post.id)}
                        className={`flex items-center gap-1 hover:text-[#00A7B5] transition-colors ${isSaved ? 'text-[#00A7B5] font-bold' : ''}`}
                        title="حفظ في المفضلة"
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                        <span>{post.saves + (isSaved ? 1 : 0)}</span>
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

        </div>

      </div>
    </section>
  );
};
