import React from 'react';
import { ShieldCheck, Mail, Phone, MapPin, Globe, CheckCircle2, Heart } from 'lucide-react';
import { PORTALS_DATA } from '../data/mockData';
import { PortalItem } from '../types';

interface FooterProps {
  onSelectPortal: (portal: PortalItem) => void;
  onOpenQuickTool: (toolId: string) => void;
  onOpenContact: () => void;
  onOpenPrivacy: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectPortal,
  onOpenQuickTool,
  onOpenContact,
  onOpenPrivacy
}) => {
  return (
    <footer className="bg-[#0B3D5B] text-slate-300 pt-16 pb-12 border-t border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/10 text-right">
          
          {/* Brand & Mission Statement (2 cols on large screens) */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center p-1.5 border border-white/20">
                <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
                  <path d="M20 4L34 12V28L20 36L6 28V12L20 4Z" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
                  <path d="M20 10L29 15.5V24.5L20 30L11 24.5V15.5L20 10Z" fill="#00A7B5" fillOpacity="0.4" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="20" cy="20" r="3.5" fill="#FFFFFF" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-latin font-bold text-xl text-white tracking-wider">NEXORA</span>
                  <span className="text-white/40">|</span>
                  <span className="font-extrabold text-lg text-[#00A7B5]">نيكسورا</span>
                </div>
                <span className="text-[11px] text-slate-400 block font-medium">منصة التعليم الذكي والمجتمع المعرفي</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed mb-6 max-w-sm">
              معاً... نصنع مستقبلاً أفضل. منصة تعليمية وتقنية متكاملة لتطوير تعليم العلوم والمختبرات الافتراضية وتمكين المجتمع التعليمي بأحدث الأدوات الرقمية.
            </p>

            {/* Live Operational Status */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>حالة النظام: جميع المختبرات والخدمات تعمل بكفاءة 100%</span>
            </div>
          </div>

          {/* Portals Links Column */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 tracking-wide">
              بوابات المنظومة
            </h4>
            <ul className="space-y-2.5 text-xs">
              {PORTALS_DATA.map((portal) => (
                <li key={portal.id}>
                  <button
                    onClick={() => onSelectPortal(portal)}
                    className="hover:text-[#00A7B5] transition-colors text-right flex items-center gap-1.5 group cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-[#00A7B5] transition-colors" />
                    <span>{portal.nameAr}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Tools & Services Column */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 tracking-wide">
              المختبرات والخدمات
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  onClick={() => onOpenQuickTool('lab')}
                  className="hover:text-[#00A7B5] transition-colors text-right flex items-center gap-1.5 group cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-[#00A7B5] transition-colors" />
                  <span>المختبر الافتراضي (NEXORA LAB)</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenQuickTool('ai-assistant')}
                  className="hover:text-[#00A7B5] transition-colors text-right flex items-center gap-1.5 group cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-[#00A7B5] transition-colors" />
                  <span>المساعد الذكي للعلوم</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenQuickTool('library')}
                  className="hover:text-[#00A7B5] transition-colors text-right flex items-center gap-1.5 group cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-[#00A7B5] transition-colors" />
                  <span>المستودع الرقمي للمناهج</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenQuickTool('academy')}
                  className="hover:text-[#00A7B5] transition-colors text-right flex items-center gap-1.5 group cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-[#00A7B5] transition-colors" />
                  <span>أكاديمية التطوير المهني</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Contact & Support Column */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 tracking-wide">
              الدعم والتواصل
            </h4>
            <ul className="space-y-3 text-xs">
              <li className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#00A7B5] shrink-0" />
                <span>فريق التطوير المعرفي والدعم التعليمي</span>
              </li>
              <li className="text-slate-400 text-[11px] leading-relaxed">
                يسعدنا تلقي استفساراتكم وملاحظاتكم التربوية والتقنية عبر نموذج التواصل المباشر.
              </li>
              <li className="pt-2">
                <button
                  onClick={onOpenContact}
                  className="w-full py-2 px-3 text-xs font-semibold text-center text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/20 cursor-pointer"
                >
                  نموذج التواصل المباشر
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Legal */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 text-center sm:text-right">
          <div>
            <p>© 2026 NEXORA | منظومة التعليم الذكي والمجتمع المعرفي. جميع الحقوق محفوظة.</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onOpenPrivacy}
              className="hover:text-white transition-colors cursor-pointer"
            >
              سياسة الخصوصية
            </button>
            <span className="text-white/20">·</span>
            <button
              onClick={onOpenPrivacy}
              className="hover:text-white transition-colors cursor-pointer"
            >
              شروط الاستخدام
            </button>
            <span className="text-white/20">·</span>
            <button
              onClick={onOpenContact}
              className="hover:text-white transition-colors cursor-pointer"
            >
              المساعدة الفنية
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
