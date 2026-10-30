import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id?: string;
  type?: ToastType;
  message: string;
  duration?: number;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  type = 'info',
  message,
  duration = 4000,
  onClose
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config = {
    success: {
      bg: 'bg-emerald-50 border-emerald-300 text-emerald-900',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
      progress: 'bg-emerald-500'
    },
    error: {
      bg: 'bg-red-50 border-red-300 text-red-900',
      icon: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />,
      progress: 'bg-red-500'
    },
    warning: {
      bg: 'bg-amber-50 border-amber-300 text-amber-900',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
      progress: 'bg-amber-500'
    },
    info: {
      bg: 'bg-cyan-50 border-cyan-300 text-cyan-900',
      icon: <Info className="w-5 h-5 text-[#00A7B5] shrink-0" />,
      progress: 'bg-[#00A7B5]'
    }
  }[type];

  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-lg transition-all animate-in fade-in slide-in-from-top-2 text-right ${config.bg}`}
    >
      <div className="flex items-center gap-2.5">
        {config.icon}
        <span className="text-xs sm:text-sm font-medium leading-relaxed">{message}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-black/5 transition-colors cursor-pointer shrink-0"
        aria-label="إغلاق الإشعار"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
