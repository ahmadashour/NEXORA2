import React, { useState } from 'react';
import { FlaskConical, Bot, Library, GraduationCap, ArrowLeft, Play, Sparkles } from 'lucide-react';
import { QUICK_TOOLS } from '../data/mockData';

interface QuickAccessSectionProps {
  onOpenLab: () => void;
  onOpenAiAssistant: () => void;
  onOpenLibrary: () => void;
  onOpenAcademy: () => void;
}

export const QuickAccessSection: React.FC<QuickAccessSectionProps> = ({
  onOpenLab,
  onOpenAiAssistant,
  onOpenLibrary,
  onOpenAcademy
}) => {
  const [labImgError, setLabImgError] = useState(false);
  const labImage = '/src/assets/images/virtual_science_lab_1793340698147.jpg';

  const handleToolAction = (id: string) => {
    switch (id) {
      case 'lab':
        onOpenLab();
        break;
      case 'ai-assistant':
        onOpenAiAssistant();
        break;
      case 'library':
        onOpenLibrary();
        break;
      case 'academy':
        onOpenAcademy();
        break;
    }
  };

  const renderIcon = (name: string) => {
    switch (name) {
      case 'FlaskConical':
        return <FlaskConical className="w-5 h-5 text-[#00A7B5]" />;
      case 'Bot':
        return <Bot className="w-5 h-5 text-[#2E9E6F]" />;
      case 'Library':
        return <Library className="w-5 h-5 text-[#0B3D5B]" />;
      case 'GraduationCap':
        return <GraduationCap className="w-5 h-5 text-[#D4AF37]" />;
      default:
        return <Sparkles className="w-5 h-5 text-[#00A7B5]" />;
    }
  };

  return (
    <section id="quick-access" className="py-16 bg-white border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 text-right">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#2E9E6F] mb-2 tracking-wide">
              <span>الوصول السريع</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-500 font-normal">أدوات العمل اليومية المباشرة</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B3D5B] tracking-tight">
              أدوات ومختبرات NEXORA المباشرة
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md">
            أدوات تفاعلية تتيح للمعلمين والطلاب الاستفادة الفورية من المختبرات الافتراضية والذكاء الاصطناعي دون تعقيد.
          </p>
        </div>

        {/* Featured Banner + 4 Quick Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Spotlight on NEXORA LAB (Left 5 Cols on desktop) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#0B3D5B] to-[#072a3f] rounded-2xl overflow-hidden p-6 sm:p-8 text-white flex flex-col justify-between shadow-lg relative group">
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="font-latin text-xs font-semibold tracking-wider text-[#00A7B5]">FEATURED WORKSPACE</span>
                <span className="text-xs font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 px-2.5 py-0.5 rounded-md">
                  مختبر تفاعلي حي
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3 text-white">
                NEXORA LAB — المختبر الافتراضي للعلوم
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                بيئة معملية آمنة تتيح تنفيذ تجارب الكيمياء، الميكانيكا، والكهرباء مع قياسات دقيقة، تفاعلات ملونة، ورصد فوري للمتغيرات.
              </p>
            </div>

            {/* Thumbnail Preview with Fallback */}
            <div className="relative rounded-xl overflow-hidden mb-6 border border-white/10 aspect-16/9 bg-slate-800">
              {!labImgError ? (
                <img
                  src={labImage}
                  alt="مختبر العلوم الافتراضي"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
                  referrerPolicy="no-referrer"
                  onError={() => setLabImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-800 text-[#00A7B5]">
                  <FlaskConical className="w-12 h-12" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                <span className="text-[11px] text-white/90">تجارب معايرة الأحماض وقانون أوم جاهزة للتجربة</span>
              </div>
            </div>

            <button
              onClick={onOpenLab}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-[#0B3D5B] bg-[#00A7B5] hover:bg-[#33b9c4] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>تشغيل تجربة المحاكاة المعملية الآن</span>
            </button>
          </div>

          {/* 4 Quick Access Grid (Right 7 Cols on desktop) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {QUICK_TOOLS.map((tool) => (
              <div
                key={tool.id}
                className="bg-[#F8FAFC] hover:bg-white rounded-xl border border-slate-200 hover:border-[#00A7B5]/40 hover:shadow-md transition-all p-5 flex flex-col justify-between group text-right"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-2xs group-hover:border-[#00A7B5]/30">
                      {renderIcon(tool.icon)}
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {tool.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#0B3D5B] mb-1 group-hover:text-[#00A7B5] transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-xs font-semibold text-[#00A7B5] mb-2">
                    {tool.subtitle}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {tool.description}
                  </p>
                </div>

                <button
                  onClick={() => handleToolAction(tool.id)}
                  className="w-full py-2 px-3 rounded-lg text-xs font-bold text-[#0B3D5B] bg-white border border-slate-300 hover:border-[#0B3D5B] hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00A7B5]"
                >
                  <span>{tool.actionText}</span>
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0B3D5B] transition-transform group-hover:-translate-x-1" />
                </button>
              </div>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
};
