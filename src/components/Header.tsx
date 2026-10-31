import React, { useState } from 'react';
import { Search, User, Menu, X, Sparkles, LogOut, ChevronDown } from 'lucide-react';
import { UserSession } from '../types';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenAuth: (initialMode?: 'login' | 'register') => void;
  userSession: UserSession;
  onLogout: () => void;
  onNavigate: (sectionId: string) => void;
  isSessionLoading?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onOpenAuth,
  userSession,
  onLogout,
  onNavigate,
  isSessionLoading = false,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navItems = [
    { id: 'hero', label: 'الرئيسية', target: 'hero' },
    { id: 'portals', label: 'بوابات المنصة', target: 'portals' },
    { id: 'quick-access', label: 'المختبرات', target: 'quick-access' },
    { id: 'resources', label: 'المصادر التعليمية', target: 'latest-content' },
    { id: 'community', label: 'المجتمع', target: 'community' },
    { id: 'events', label: 'الأنشطة والفعاليات', target: 'latest-content' },
  ];

  const handleNavClick = (target: string) => {
    onNavigate(target);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FFFFFF]/95 backdrop-blur-md border-b border-slate-200 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        
        {/* Brand Zone */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleNavClick('hero')}
            className="flex items-center gap-3 text-right group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00A7B5] rounded-lg p-1"
            title="NEXORA | نيكسورا"
          >
            {/* Custom Modern Geometric Logo Mark */}
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0B3D5B] to-[#00A7B5] flex items-center justify-center shadow-sm text-white font-bold p-1.5 transition-transform group-hover:scale-105">
              <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
                <path d="M20 4L34 12V28L20 36L6 28V12L20 4Z" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
                <path d="M20 10L29 15.5V24.5L20 30L11 24.5V15.5L20 10Z" fill="#00A7B5" fillOpacity="0.4" stroke="#D4AF37" strokeWidth="1.5" />
                <circle cx="20" cy="20" r="3.5" fill="#FFFFFF" />
                <circle cx="20" cy="8" r="2" fill="#D4AF37" />
                <circle cx="31" cy="26" r="2" fill="#2E9E6F" />
                <circle cx="9" cy="26" r="2" fill="#00A7B5" />
              </svg>
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-latin font-bold text-2xl tracking-wider text-[#0B3D5B]">NEXORA</span>
                <span className="text-slate-300">|</span>
                <span className="font-extrabold text-xl text-[#00A7B5]">نيكسورا</span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 tracking-tight hidden sm:block">
                منصة التعليم الذكي والمجتمع المعرفي
              </span>
            </div>
          </button>
        </div>

        {/* Navigation Zone */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm font-medium text-slate-700">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.target)}
              className="hover:text-[#00A7B5] transition-colors py-2 relative whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00A7B5] rounded cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Action Controls Zone */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          
          {/* Universal Search Button */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 bg-slate-100/80 hover:bg-slate-200/80 hover:text-slate-900 text-xs sm:text-sm font-medium transition-colors border border-slate-200/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00A7B5] cursor-pointer"
            aria-label="البحث الشامل في المنصة"
            title="البحث الشامل (Ctrl+K أو /)"
          >
            <Search className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">البحث في المنصة</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white text-slate-400 border border-slate-200 rounded">
              /
            </kbd>
          </button>

          {/* User Auth / Profile */}
          {isSessionLoading ? (
            <div className="h-9 w-20 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-[#00A7B5] animate-spin" />
            </div>
          ) : userSession.isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0B3D5B]/5 border border-[#0B3D5B]/20 text-[#0B3D5B] hover:bg-[#0B3D5B]/10 transition-colors text-sm font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00A7B5] cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-[#0B3D5B] text-white flex items-center justify-center text-xs font-bold">
                  {userSession.name ? userSession.name.charAt(0) : 'م'}
                </div>
                <div className="flex flex-col text-right hidden sm:block">
                  <span className="text-xs font-bold leading-tight">{userSession.name}</span>
                  <span className="text-[10px] text-slate-500 leading-tight">{userSession.role}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {userDropdownOpen && (
                <div className="absolute left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 border-b border-slate-100 text-right">
                    <p className="text-xs font-bold text-slate-900">{userSession.name}</p>
                    <p className="text-[11px] text-slate-500">{userSession.role}</p>
                  </div>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onNavigate('portals');
                    }}
                    className="w-full text-right px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>لوحة التحكم الخاصة بي</span>
                    <Sparkles className="w-3.5 h-3.5 text-[#00A7B5]" />
                  </button>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full text-right px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>تسجيل الخروج</span>
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth('login')}
                className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#0B3D5B] hover:text-[#00A7B5] hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00A7B5] cursor-pointer"
              >
                تسجيل الدخول
              </button>

              <button
                onClick={() => onOpenAuth('register')}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#0B3D5B] hover:bg-[#072a3f] active:bg-[#0B3D5B] rounded-lg transition-all shadow-xs whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00A7B5] cursor-pointer"
              >
                إنشاء حساب
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00A7B5] cursor-pointer"
            aria-label="القائمة الرئيسية"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 shadow-xl animate-in slide-in-from-top-4">
          <div className="space-y-1 mb-4">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.target)}
                className="w-full text-right px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 hover:text-[#00A7B5] rounded-lg transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {!userSession.isLoggedIn && (
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('login');
                }}
                className="w-full py-2.5 text-center text-sm font-semibold text-[#0B3D5B] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                تسجيل الدخول
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('register');
                }}
                className="w-full py-2.5 text-center text-sm font-semibold text-white bg-[#0B3D5B] hover:bg-[#072a3f] rounded-lg transition-colors"
              >
                إنشاء حساب
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
