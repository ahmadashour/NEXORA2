import React, { useState } from 'react';
import { ArrowLeft, Compass, Sparkles, Beaker, CheckCircle2 } from 'lucide-react';

interface HeroProps {
  onDiscover: () => void;
  onStartJourney: () => void;
  onOpenQuickLab: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  onDiscover,
  onStartJourney,
  onOpenQuickLab
}) => {
  const [imageError, setImageError] = useState(false);
  const heroImagePath = '/src/assets/images/hero_science_ai_lab_1793340697646.jpg';

  return (
    <section id="hero" className="relative overflow-hidden bg-gradient-to-b from-[#FFFFFF] via-[#F8FAFC] to-[#F5F7FA] border-b border-slate-200/80 pt-10 pb-16 lg:pt-16 lg:pb-24">
      {/* Subtle Ambient Decorative Gradient Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#00A7B5]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-[#0B3D5B]/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Text Column */}
          <div className="lg:col-span-7 flex flex-col text-right">
            
            {/* Slogan Kicker */}
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#00A7B5] mb-4">
              <span className="w-2 h-2 rounded-full bg-[#00A7B5]" aria-hidden="true" />
              <span>معاً... نصنع مستقبلاً أفضل</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 font-normal">منظومة التعليم الذكي والمجتمع المعرفي</span>
            </div>

            {/* Main Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0B3D5B] tracking-tight leading-tight mb-5" style={{ textWrap: 'balance' }}>
              منصة رائدة لتعليم العلوم والتكنولوجيا والمختبرات الذكية
            </h1>

            {/* Concise System Description */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mb-8">
              بيئة تعليمية تفاعلية موحدة تجمع التوجيه الفني، الإدارات المدرسية، المعلمين، الطلاب، وأولياء الأمور
              في فضاء معرفي متكامل مدعوم بالمختبرات الافتراضية والذكاء الاصطناعي لترسيخ الابتكار العلمي وبناء مهارات الغد.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 mb-8">
              <button
                onClick={onStartJourney}
                className="px-6 py-3.5 rounded-xl font-bold text-sm sm:text-base text-white bg-[#0B3D5B] hover:bg-[#072a3f] active:scale-[0.99] transition-all shadow-md shadow-[#0B3D5B]/20 flex items-center gap-2 group cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00A7B5]"
              >
                <span>ابدأ رحلتك</span>
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              </button>

              <button
                onClick={onDiscover}
                className="px-6 py-3.5 rounded-xl font-bold text-sm sm:text-base text-[#0B3D5B] bg-white hover:bg-slate-50 border border-slate-300 transition-all shadow-xs flex items-center gap-2 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00A7B5]"
              >
                <Compass className="w-4 h-4 text-[#00A7B5]" />
                <span>اكتشف المنصة</span>
              </button>
            </div>

            {/* Key Platform Highlights (Zero-Pill Discipline) */}
            <div className="pt-6 border-t border-slate-200/80 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs sm:text-sm text-slate-600">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#2E9E6F]" />
                <span className="font-semibold text-slate-800">6 بوابات متخصصة</span>
              </div>
              <span className="text-slate-300">·</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#2E9E6F]" />
                <span>مختبرات محاكاة 3D</span>
              </div>
              <span className="text-slate-300">·</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#2E9E6F]" />
                <span>مساعد تربوي ذكي</span>
              </div>
              <span className="text-slate-300">·</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#2E9E6F]" />
                <span>مجتمع علمي تفاعلي</span>
              </div>
            </div>

          </div>

          {/* Visual Showcase Column */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden border border-slate-200/90 shadow-xl bg-slate-900 group">
              
              {!imageError ? (
                <div className="relative aspect-16/11 w-full">
                  <img
                    src={heroImagePath}
                    alt="مختبر NEXORA الافتراضي للعلوم والذكاء الاصطناعي"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-102"
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B3D5B]/90 via-[#0B3D5B]/30 to-transparent" />
                </div>
              ) : (
                /* Styled CSS / SVG Fallback if image fails */
                <div className="aspect-16/11 w-full bg-gradient-to-br from-[#0B3D5B] via-[#008591] to-[#2E9E6F] p-8 flex flex-col justify-between text-white">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                      <Beaker className="w-6 h-6 text-[#D4AF37]" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/80">STEM Virtual Lab</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">مختبر العلوم الرقمي التفاعلي</h3>
                    <p className="text-xs text-white/80">تجارب الكيمياء والفيزياء والأحياء ثلاثية الأبعاد</p>
                  </div>
                </div>
              )}

              {/* Interactive Overlay Badge on the Visual */}
              <div className="absolute bottom-4 right-4 left-4 p-3.5 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/60 shadow-md flex items-center justify-between gap-3 text-right">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#00A7B5]/10 text-[#00A7B5] flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-[#00A7B5]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">مختبر المحاكاة الافتراضي المباشر</h4>
                    <p className="text-[11px] text-slate-500 leading-tight">تجارب الكيمياء والفيزياء متاحة الآن</p>
                  </div>
                </div>
                
                <button
                  onClick={onOpenQuickLab}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#00A7B5] hover:bg-[#008591] rounded-lg transition-colors shrink-0 shadow-xs cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0B3D5B]"
                >
                  تجربة فورية
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
