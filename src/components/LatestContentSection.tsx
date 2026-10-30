import React, { useState } from 'react';
import { FileText, Video, Newspaper, Calendar, ArrowLeft, Eye, Heart, Clock, Download, MapPin } from 'lucide-react';
import { LATEST_CONTENT } from '../data/mockData';
import { ContentItem } from '../types';

interface LatestContentSectionProps {
  onSelectContent: (item: ContentItem) => void;
  onViewAllResources?: () => void;
}

export const LatestContentSection: React.FC<LatestContentSectionProps> = ({
  onSelectContent,
  onViewAllResources
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'resource' | 'video' | 'news' | 'event'>('all');

  const categories = [
    { id: 'all', label: 'جميع المستجدات' },
    { id: 'resource', label: 'المصادر التعليمية' },
    { id: 'video', label: 'الفيديوهات التفاعلية' },
    { id: 'news', label: 'جديد التربية والعلوم' },
    { id: 'event', label: 'الفعاليات القادمة' },
  ];

  const filteredItems = activeTab === 'all' 
    ? LATEST_CONTENT.slice(0, 4) 
    : LATEST_CONTENT.filter(item => item.category === activeTab).slice(0, 4);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'resource':
        return <FileText className="w-4 h-4 text-[#00A7B5]" />;
      case 'video':
        return <Video className="w-4 h-4 text-[#2E9E6F]" />;
      case 'news':
        return <Newspaper className="w-4 h-4 text-[#0B3D5B]" />;
      case 'event':
        return <Calendar className="w-4 h-4 text-[#D4AF37]" />;
      default:
        return <FileText className="w-4 h-4 text-[#00A7B5]" />;
    }
  };

  return (
    <section id="latest-content" className="py-16 bg-[#F5F7FA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header with Category Tabs */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 text-right">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#0B3D5B] mb-2 tracking-wide">
              <span>المحتوى المتجدد</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-500 font-normal">مستودع المناهج، الوسائط، والمستجدات التعليمية</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B3D5B] tracking-tight">
              أحدث المصادر والفعاليات العلمية
            </h2>
          </div>

          {/* Interactive Category Filter (Segmented control) */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-2xs self-start md:self-auto">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id as any)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00A7B5] ${
                  activeTab === cat.id
                    ? 'bg-[#0B3D5B] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Cards Grid (Max 4 cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectContent(item)}
              className="bg-white rounded-xl border border-slate-200/90 hover:border-[#00A7B5]/40 hover:shadow-md transition-all p-5 flex flex-col justify-between group cursor-pointer text-right"
            >
              <div>
                {/* Unboxed Metadata Header */}
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    {getCategoryIcon(item.category)}
                    <span>{item.categoryLabel}</span>
                  </div>
                  <span className="text-slate-400 font-latin text-[11px]">{item.date}</span>
                </div>

                {/* Card Title */}
                <h3 className="text-sm font-bold text-[#0B3D5B] group-hover:text-[#00A7B5] transition-colors leading-snug mb-2 line-clamp-2">
                  {item.title}
                </h3>

                {/* Card Description */}
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-4">
                  {item.description}
                </p>
              </div>

              {/* Card Footer / Contextual Information */}
              <div className="pt-3 border-t border-slate-100">
                {/* If Event, show date and location */}
                {item.category === 'event' && item.eventDetails && (
                  <div className="mb-2 text-[11px] text-slate-500 space-y-1">
                    <div className="flex items-center gap-1 text-amber-700">
                      <Clock className="w-3 h-3" />
                      <span>{item.eventDetails.time}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>{item.eventDetails.locationType}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-emerald-700 font-medium">متبقي {item.eventDetails.seatsLeft} مقعد</span>
                    </div>
                  </div>
                )}

                {/* If Resource, show file size and subject */}
                {item.category === 'resource' && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                    <span className="text-slate-700 font-medium">{item.subject} · {item.gradeLevel}</span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Download className="w-3 h-3" />
                      {item.fileSize}
                    </span>
                  </div>
                )}

                {/* If Video, show duration */}
                {item.category === 'video' && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                    <span className="text-slate-700 font-medium">{item.subject}</span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3" />
                      {item.duration}
                    </span>
                  </div>
                )}

                {/* Card Action Link */}
                <div className="flex items-center justify-between text-xs font-semibold text-[#00A7B5] group-hover:text-[#0B3D5B] transition-colors">
                  <span>
                    {item.category === 'event' ? 'تفاصيل وحجز مقعد' : item.category === 'video' ? 'مشاهدة الفيديو' : 'عرض وتحميل'}
                  </span>
                  <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                </div>
              </div>

            </div>
          ))}
        </div>

        {/* View More Action */}
        <div className="mt-8 text-center">
          <button
            onClick={onViewAllResources}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-[#0B3D5B] bg-white border border-slate-300 hover:border-[#00A7B5] hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00A7B5]"
          >
            <span>استعراض أرشيف المصادر والفعاليات بالكامل</span>
            <ArrowLeft className="w-4 h-4 text-[#00A7B5]" />
          </button>
        </div>

      </div>
    </section>
  );
};
