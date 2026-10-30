import React from 'react';
import { 
  Compass, 
  Briefcase, 
  BookOpenCheck, 
  Sparkles, 
  Atom, 
  HeartHandshake, 
  ArrowLeft 
} from 'lucide-react';
import { PORTALS_DATA } from '../data/mockData';
import { PortalItem } from '../types';

interface PortalsSectionProps {
  onSelectPortal: (portal: PortalItem) => void;
}

export const PortalsSection: React.FC<PortalsSectionProps> = ({ onSelectPortal }) => {
  // Mapping icons dynamically
  const renderIcon = (name: string, color: string) => {
    const props = { className: 'w-6 h-6', style: { color } };
    switch (name) {
      case 'Compass':
        return <Compass {...props} />;
      case 'Briefcase':
        return <Briefcase {...props} />;
      case 'BookOpenCheck':
        return <BookOpenCheck {...props} />;
      case 'Sparkles':
        return <Sparkles {...props} />;
      case 'Atom':
        return <Atom {...props} />;
      case 'HeartHandshake':
        return <HeartHandshake {...props} />;
      default:
        return <Compass {...props} />;
    }
  };

  return (
    <section id="portals" className="py-16 lg:py-24 bg-[#F5F7FA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-right max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#00A7B5] mb-2 tracking-wide">
            <span>بوابات المنظومة</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500 font-normal">منصات متخصصة لكل شريك في العملية التعليمية</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B3D5B] tracking-tight mb-3">
            بوابات NEXORA التعليمية المتكاملة
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            ست بيئات عمل رقمية مصممة خصيصاً لتلبية احتياجات التوجيه الفني، الإدارة المدرسية، المعلمين، المعلمين الجدد، الطلاب، وأولياء الأمور بنقرة واحدة.
          </p>
        </div>

        {/* 6 Portals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PORTALS_DATA.map((portal) => {
            return (
              <div
                key={portal.id}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between p-6 group relative overflow-hidden"
              >
                {/* Top Subtle Border Accent Line matching portal brand */}
                <div
                  className="absolute top-0 right-0 left-0 h-1 transition-all group-hover:h-1.5"
                  style={{ backgroundColor: portal.accentColor }}
                />

                <div>
                  {/* Card Header: Icon + Target Role */}
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                      style={{ backgroundColor: portal.bgLight }}
                    >
                      {renderIcon(portal.iconName, portal.accentColor)}
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      {portal.targetRole}
                    </span>
                  </div>

                  {/* Portal Titles */}
                  <div className="mb-3">
                    <span className="font-latin text-xs font-bold tracking-wider text-slate-400 block mb-0.5">
                      {portal.nameEn}
                    </span>
                    <h3 className="text-lg font-bold text-[#0B3D5B] group-hover:text-[#00A7B5] transition-colors">
                      {portal.nameAr}
                    </h3>
                  </div>

                  {/* One-line Description */}
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                    {portal.description}
                  </p>
                </div>

                {/* Entry Action Button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {portal.stats[0]?.label}: <strong className="text-slate-700 font-semibold">{portal.stats[0]?.value}</strong>
                  </span>

                  <button
                    onClick={() => onSelectPortal(portal)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all shadow-xs cursor-pointer group-hover:gap-2.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-1"
                    style={{ backgroundColor: portal.accentColor }}
                  >
                    <span>دخول البوابة</span>
                    <ArrowLeft className="w-3.5 h-3.5 transition-transform" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
