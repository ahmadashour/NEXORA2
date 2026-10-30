import React, { useState } from 'react';
import { X, Download, Share2, Heart, CheckCircle2, Calendar, Clock, MapPin, Video, FileText, ArrowLeft, Play } from 'lucide-react';
import { ContentItem } from '../../types';

interface ContentDetailModalProps {
  item: ContentItem | null;
  onClose: () => void;
}

export const ContentDetailModal: React.FC<ContentDetailModalProps> = ({ item, onClose }) => {
  if (!item) return null;

  const [registered, setRegistered] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  const handleRegister = () => {
    setRegistered(true);
  };

  const handleDownload = () => {
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-5 bg-[#0B3D5B] text-white flex items-center justify-between border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2 text-xs text-white/80 mb-1">
              <span className="font-semibold text-[#00A7B5]">{item.categoryLabel}</span>
              <span>·</span>
              <span>{item.subject}</span>
              {item.gradeLevel && (
                <>
                  <span>·</span>
                  <span>{item.gradeLevel}</span>
                </>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold leading-snug">{item.title}</h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-xs sm:text-sm leading-relaxed">
          
          {/* If Video: show simulated video player */}
          {item.category === 'video' && (
            <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-800 aspect-16/9 relative flex items-center justify-center text-white">
              {!isPlayingVideo ? (
                <div className="text-center p-6">
                  <button
                    onClick={() => setIsPlayingVideo(true)}
                    className="w-14 h-14 rounded-full bg-[#00A7B5] hover:bg-[#008591] text-white flex items-center justify-center mx-auto mb-3 shadow-lg transition-transform hover:scale-105 cursor-pointer"
                  >
                    <Play className="w-6 h-6 fill-current mr-0.5" />
                  </button>
                  <span className="text-xs font-semibold block text-slate-200">انقر لتشغيل المحاكاة المرئية</span>
                  <span className="text-[11px] text-slate-400">المدة: {item.duration}</span>
                </div>
              ) : (
                <div className="w-full h-full p-6 flex flex-col justify-between bg-slate-950">
                  <div className="flex justify-between items-center text-xs text-slate-300">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      بث المحتوى العلمي التفاعلي
                    </span>
                    <button onClick={() => setIsPlayingVideo(false)} className="text-xs text-slate-400 hover:text-white">إيقاف</button>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white mb-1">{item.title}</p>
                    <p className="text-xs text-slate-400">جاري عرض التجارب المخبرية والشروح ثلاثية الأبعاد بجودة 1080p</p>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#00A7B5] h-full w-1/3 animate-pulse" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* If Event: show dates & registration block */}
          {item.category === 'event' && item.eventDetails && (
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2">
              <h4 className="font-bold text-[#0B3D5B] text-xs">تفاصيل الموعد والمكان:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span>{item.eventDetails.date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>{item.eventDetails.time}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  <span>المقر: {item.eventDetails.locationType}</span>
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>المقاعد الشاغرة: {item.eventDetails.seatsLeft}</span>
                </div>
              </div>

              {!registered ? (
                <button
                  onClick={handleRegister}
                  className="w-full mt-3 py-2.5 rounded-lg text-xs font-bold text-white bg-[#0B3D5B] hover:bg-[#072a3f] transition-colors cursor-pointer shadow-xs"
                >
                  تأكيد حجز مقعد في الفعالية
                </button>
              ) : (
                <div className="mt-3 p-2.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>تم تأكيد تسجيلك بنجاح! ستصلك رسالة بالدعوة والرابط عبر البريد.</span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold text-[#0B3D5B] mb-2">الوصف المنهجي المعتمد:</h4>
            <p className="text-slate-600 leading-relaxed">{item.description}</p>
          </div>

          {/* Resource Details / Download Action */}
          {item.category === 'resource' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 text-xs block">الملف الرقمي المعتمد</span>
                <span className="text-[11px] text-slate-500">{item.fileSize} · متاح للتحميل والطباعة الميدانية</span>
              </div>

              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#00A7B5] hover:bg-[#008591] transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloaded ? 'جاري التحميل...' : 'تحميل الملف'}</span>
              </button>
            </div>
          )}

          {/* Author or Department Info */}
          {item.author && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>إعداد وتدقيق: <strong className="text-slate-800 font-semibold">{item.author.name}</strong> ({item.author.role})</span>
              <span>تاريخ النشر: {item.date}</span>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => setLiked(!liked)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              liked ? 'text-red-600 bg-red-50 border-red-200' : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
            <span>{item.likes ? item.likes + (liked ? 1 : 0) : 'إعجاب'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
