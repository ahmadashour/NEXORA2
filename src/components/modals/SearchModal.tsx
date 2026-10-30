import React, { useState, useEffect } from 'react';
import { Search, X, ArrowLeft, BookOpen, FlaskConical, Users, Calendar, Newspaper, ExternalLink } from 'lucide-react';
import { PORTALS_DATA, QUICK_TOOLS, LATEST_CONTENT, COMMUNITY_POSTS } from '../../data/mockData';
import { PortalItem, ContentItem, CommunityPost } from '../../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPortal: (portal: PortalItem) => void;
  onSelectContent: (item: ContentItem) => void;
  onSelectPost: (post: CommunityPost) => void;
  onOpenLab: () => void;
  onOpenAiAssistant: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectPortal,
  onSelectContent,
  onSelectPost,
  onOpenLab,
  onOpenAiAssistant
}) => {
  if (!isOpen) return null;

  const [query, setQuery] = useState('');

  // Keyboard shortcut ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const normalizedQuery = query.trim().toLowerCase();

  // Filtered matching items
  const matchedPortals = PORTALS_DATA.filter(p => 
    !normalizedQuery || 
    p.nameAr.includes(normalizedQuery) || 
    p.nameEn.toLowerCase().includes(normalizedQuery) || 
    p.description.includes(normalizedQuery) || 
    p.targetRole.includes(normalizedQuery)
  );

  const matchedContent = LATEST_CONTENT.filter(c => 
    !normalizedQuery || 
    c.title.includes(normalizedQuery) || 
    c.description.includes(normalizedQuery) || 
    c.subject.includes(normalizedQuery)
  );

  const matchedPosts = COMMUNITY_POSTS.filter(post => 
    !normalizedQuery || 
    post.title.includes(normalizedQuery) || 
    post.summary.includes(normalizedQuery) || 
    post.author.name.includes(normalizedQuery) || 
    post.subject.includes(normalizedQuery)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right"
        role="dialog"
        aria-modal="true"
      >
        {/* Search Bar Input */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-[#F8FAFC]">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في البوابات، المختبرات الافتراضية، المناهج، والمشاركات..."
            className="w-full bg-transparent border-none text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-hidden text-right"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-semibold px-2.5 py-1 text-slate-500 hover:text-slate-900 bg-slate-200/60 rounded-md cursor-pointer shrink-0"
          >
            إلغاء [ESC]
          </button>
        </div>

        {/* Results Container */}
        <div className="p-4 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Quick Shortcuts */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 block mb-2">أدوات الوصول السريع:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenLab();
                }}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-[#00A7B5]/10 hover:border-[#00A7B5]/40 transition-colors flex items-center justify-between text-right cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-[#00A7B5]" />
                  <div>
                    <span className="font-bold text-slate-800 block">NEXORA LAB</span>
                    <span className="text-[10px] text-slate-500">المختبر الافتراضي المباشر</span>
                  </div>
                </div>
                <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenAiAssistant();
                }}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-[#2E9E6F]/10 hover:border-[#2E9E6F]/40 transition-colors flex items-center justify-between text-right cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#2E9E6F]" />
                  <div>
                    <span className="font-bold text-slate-800 block">المساعد الذكي</span>
                    <span className="text-[10px] text-slate-500">مساعد تحضير العلوم</span>
                  </div>
                </div>
                <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Portals Results */}
          {matchedPortals.length > 0 && (
            <div>
              <span className="text-[11px] font-bold text-slate-400 block mb-2">
                البوابات التعليمية ({matchedPortals.length}):
              </span>
              <div className="space-y-1.5">
                {matchedPortals.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onClose();
                      onSelectPortal(p);
                    }}
                    className="w-full p-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors flex items-center justify-between text-right cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-[#0B3D5B] block">{p.nameAr} ({p.nameEn})</span>
                      <span className="text-[11px] text-slate-500">{p.description}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-white px-2 py-0.5 rounded shadow-2xs" style={{ backgroundColor: p.accentColor }}>
                      دخول
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Educational Resources & Content */}
          {matchedContent.length > 0 && (
            <div>
              <span className="text-[11px] font-bold text-slate-400 block mb-2">
                المصادر والوسائط والفعاليات ({matchedContent.length}):
              </span>
              <div className="space-y-1.5">
                {matchedContent.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onClose();
                      onSelectContent(c);
                    }}
                    className="w-full p-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors flex items-center justify-between text-right cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px] mb-0.5">
                        <span className="font-semibold text-slate-600">{c.categoryLabel}</span>
                        <span>·</span>
                        <span>{c.subject}</span>
                      </div>
                      <span className="font-bold text-slate-800 block line-clamp-1">{c.title}</span>
                    </div>
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Teacher Posts */}
          {matchedPosts.length > 0 && (
            <div>
              <span className="text-[11px] font-bold text-slate-400 block mb-2">
                مشاركات المجتمع المعرفي ({matchedPosts.length}):
              </span>
              <div className="space-y-1.5">
                {matchedPosts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => {
                      onClose();
                      onSelectPost(post);
                    }}
                    className="w-full p-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors flex items-center justify-between text-right cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block line-clamp-1">{post.title}</span>
                      <span className="text-[11px] text-slate-500">{post.author.name} · {post.author.school}</span>
                    </div>
                    <span className="text-[10px] text-[#00A7B5] bg-[#00A7B5]/10 px-2 py-0.5 rounded">
                      {post.subject}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-400">
          انقر فوق أي عنصر للوصول الفوري المباشر إليه
        </div>

      </div>
    </div>
  );
};
