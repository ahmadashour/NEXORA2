import React, { useState, useEffect } from 'react';
import {
  X,
  Heart,
  Calendar,
  Clock,
  MapPin,
  Play,
  ArrowLeft,
  AlertCircle,
  Loader2,
  FileText,
  Eye,
  CheckCircle2,
  Users,
  UserCheck,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { ContentItem } from '../../types';
import { UnifiedContentViewModel, EventDetailViewModel } from '../../types/contracts';
import { contentService } from '../../services/contentService';
import { eventsService, ApiError } from '../../services/eventsService';

interface ContentDetailModalProps {
  item: ContentItem | null;
  onClose: () => void;
}

export const ContentDetailModal: React.FC<ContentDetailModalProps> = ({ item, onClose }) => {
  if (!item) return null;

  const isEvent = item.category === 'event';

  const [detailedItem, setDetailedItem] = useState<UnifiedContentViewModel | ContentItem>(item);
  const [eventDetail, setEventDetail] = useState<EventDetailViewModel | null>(
    (item as any).eventInfo || null
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [liked, setLiked] = useState<boolean>(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState<boolean>(false);

  // Event registration states
  const [isActionPending, setIsActionPending] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setDetailedItem(item);
    setEventDetail((item as any).eventInfo || null);
    setError(null);
    setNotFound(false);
    setIsPlayingVideo(false);
    setActionNotice(null);
    setShowCancelConfirm(false);

    if (item.id && !item.id.startsWith('mock_')) {
      setIsLoading(true);

      if (isEvent) {
        // Fetch verified live event data from Events API
        eventsService.getEventById(item.id)
          .then((res) => {
            if (isMounted) {
              setEventDetail(res.event);
              if (res.content) {
                setDetailedItem(res.content);
              }
            }
          })
          .catch((err: unknown) => {
            if (!isMounted) return;
            if (err instanceof ApiError && err.status === 404) {
              setNotFound(true);
            } else {
              const msg = err instanceof ApiError ? err.message : 'تعذر استرجاع بيانات الفعالية من الخادم';
              setError(msg);
            }
          })
          .finally(() => {
            if (isMounted) {
              setIsLoading(false);
            }
          });
      } else {
        // Fetch standard content from Content API
        contentService.getContentById(item.id)
          .then((freshData) => {
            if (isMounted) {
              setDetailedItem(freshData);
            }
          })
          .catch((err: unknown) => {
            if (!isMounted) return;
            if (err instanceof ApiError && err.status === 404) {
              setNotFound(true);
            } else {
              const msg = err instanceof ApiError ? err.message : 'تعذر تحديث بيانات المحتوى من الخادم';
              setError(msg);
            }
          })
          .finally(() => {
            if (isMounted) {
              setIsLoading(false);
            }
          });
      }
    }

    return () => {
      isMounted = false;
    };
  }, [item, isEvent]);

  const activeItem = detailedItem || item;

  // Handle Event Registration
  const handleRegister = async () => {
    if (isActionPending || !item.id) return;
    setIsActionPending(true);
    setActionNotice(null);

    try {
      const targetId = eventDetail?.id || item.id;
      const res = await eventsService.registerForEvent(targetId);
      
      setEventDetail((prev) => {
        if (!prev) return prev;
        const newBooked = prev.seatsBooked + 1;
        const newLeft = Math.max(0, prev.seatsCapacity - newBooked);
        return {
          ...prev,
          seatsBooked: newBooked,
          seatsLeft: newLeft,
          isFullyBooked: newLeft <= 0,
          isRegisteredByMe: true,
        };
      });

      setActionNotice({
        type: 'success',
        text: res.message || 'تم تأكيد تسجيلك في الفعالية بنجاح',
      });
    } catch (err: unknown) {
      let msg = 'تعذر إتمام التسجيل في الفعالية';
      if (err instanceof ApiError) {
        if (err.status === 401) {
          msg = 'يجب تسجيل الدخول أولاً لإتمام التسجيل في الفعالية الأكاديمية';
        } else if (err.status === 409) {
          msg = err.code === 'ALREADY_REGISTERED'
            ? 'أنت مسجل مسبقاً في هذه الفعالية'
            : 'عذراً، اكتملت سعة المقاعد المتاحة لهذه الفعالية';
        } else if (err.status === 429) {
          msg = 'تم إرسال طلبات متعددة، يرجى الانتظار قليلاً ثم المحاولة';
        } else {
          msg = err.message || msg;
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setActionNotice({ type: 'error', text: msg });
    } finally {
      setIsActionPending(false);
    }
  };

  // Handle Event Registration Cancellation
  const handleCancelRegistration = async () => {
    if (isActionPending || !item.id) return;
    setIsActionPending(true);
    setActionNotice(null);
    setShowCancelConfirm(false);

    try {
      const targetId = eventDetail?.id || item.id;
      const res = await eventsService.cancelRegistration(targetId);

      setEventDetail((prev) => {
        if (!prev) return prev;
        const newBooked = Math.max(0, prev.seatsBooked - 1);
        const newLeft = Math.max(0, prev.seatsCapacity - newBooked);
        return {
          ...prev,
          seatsBooked: newBooked,
          seatsLeft: newLeft,
          isFullyBooked: newLeft <= 0,
          isRegisteredByMe: false,
        };
      });

      setActionNotice({
        type: 'success',
        text: res.message || 'تم إلغاء التسجيل في الفعالية بنجاح',
      });
    } catch (err: unknown) {
      let msg = 'تعذر إلغاء التسجيل في الفعالية';
      if (err instanceof ApiError) {
        if (err.status === 404) {
          msg = 'لم يتم العثور على تسجيل نشط لك في هذه الفعالية';
        } else {
          msg = err.message || msg;
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setActionNotice({ type: 'error', text: msg });
    } finally {
      setIsActionPending(false);
    }
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
              <span className="font-semibold text-[#00A7B5]">{activeItem.categoryLabel || 'محتوى تعليمي'}</span>
              {activeItem.subject && (
                <>
                  <span>·</span>
                  <span>{activeItem.subject}</span>
                </>
              )}
              {activeItem.gradeLevel && (
                <>
                  <span>·</span>
                  <span>{activeItem.gradeLevel}</span>
                </>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold leading-snug line-clamp-2">
              {activeItem.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0 mr-2"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 bg-white">
          
          {/* Action Notice (Registration / Cancellation Result) */}
          {actionNotice && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                actionNotice.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border border-red-200 text-red-900'
              }`}
            >
              {actionNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              )}
              <span>{actionNotice.text}</span>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2.5 text-xs text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin text-[#00A7B5]" />
                <span>جاري تحديث البيانات المباشرة من خادم المنصة...</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {!isLoading && error && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 404 Item Not Found State */}
          {notFound ? (
            <div className="text-center py-12 px-4 bg-slate-50 rounded-xl border border-slate-200">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800 mb-1">العنصر المطلوب غير متاح</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                قد يكون هذا العنصر تم أرشفته أو لم يعد متوفراً في قاعدة البيانات المباشرة.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-[#0B3D5B] text-white rounded-lg text-xs font-bold hover:bg-[#082b40] transition-colors cursor-pointer"
              >
                العودة للمنصة
              </button>
            </div>
          ) : (
            <>
              {/* Media Player Section if Video */}
              {activeItem.category === 'video' && (
                <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-800 aspect-16/9 relative flex items-center justify-center text-white">
                  {!isPlayingVideo ? (
                    <div className="text-center p-6">
                      <button
                        onClick={() => setIsPlayingVideo(true)}
                        className="w-14 h-14 rounded-full bg-[#00A7B5] hover:bg-[#008591] text-white flex items-center justify-center mx-auto mb-3 shadow-lg transition-transform hover:scale-105 cursor-pointer"
                      >
                        <Play className="w-6 h-6 fill-current mr-0.5" />
                      </button>
                      <span className="text-xs font-semibold block text-slate-200">تشغيل الفيديو التعليمي</span>
                      {activeItem.duration && (
                        <span className="text-[11px] text-slate-400">المدة: {activeItem.duration}</span>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full p-6 flex flex-col justify-between bg-slate-950">
                      <div className="flex justify-between items-center text-xs text-slate-300">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          بث المحتوى العلمي التفاعلي
                        </span>
                        <button onClick={() => setIsPlayingVideo(false)} className="text-xs text-slate-400 hover:text-white cursor-pointer">
                          إيقاف
                        </button>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-white mb-1">{activeItem.title}</p>
                        <p className="text-xs text-slate-400">جاري عرض التجارب المخبرية والشروح العلمية التفاعلية</p>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#00A7B5] h-full w-1/3 animate-pulse" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* If Event: Event Details & Real-Time Capacity Panel */}
              {isEvent && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                    <h4 className="font-bold text-[#0B3D5B] text-xs">معلومات وجدولة الفعالية العلمية:</h4>
                    {eventDetail && (
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        eventDetail.isRegisteredByMe
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : eventDetail.isFullyBooked
                          ? 'bg-red-100 text-red-800 border border-red-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {eventDetail.isRegisteredByMe
                          ? '✓ مسجل بالفعالية'
                          : eventDetail.isFullyBooked
                          ? 'اكتملت المقاعد'
                          : 'التسجيل متاح'}
                      </span>
                    )}
                  </div>

                  {/* Schedule & Venue Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                    {(eventDetail?.eventDate || activeItem.eventDetails?.date) && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>التاريخ: {eventDetail?.eventDate || activeItem.eventDetails?.date}</span>
                      </div>
                    )}
                    {(eventDetail?.eventTime || activeItem.eventDetails?.time) && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>الوقت: {eventDetail?.eventTime || activeItem.eventDetails?.time}</span>
                      </div>
                    )}
                    {eventDetail?.durationFormatted && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#00A7B5] shrink-0" />
                        <span>المدة: {eventDetail.durationFormatted}</span>
                      </div>
                    )}
                    {(eventDetail?.locationTypeFormatted || activeItem.eventDetails?.locationType) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          المقر: {eventDetail?.locationTypeFormatted || activeItem.eventDetails?.locationType}
                          {eventDetail?.locationAddress ? ` (${eventDetail.locationAddress})` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Speaker Info (Only rendered if available from backend) */}
                  {eventDetail && eventDetail.speakerName && (
                    <div className="pt-2 border-t border-amber-200/50 text-xs text-slate-700">
                      <span>المتحدث / المدرب: </span>
                      <strong className="font-bold text-slate-900">{eventDetail.speakerName}</strong>
                      {eventDetail.speakerTitle && (
                        <span className="text-slate-500"> — {eventDetail.speakerTitle}</span>
                      )}
                    </div>
                  )}

                  {/* Seats Capacity Indicators */}
                  {eventDetail && (
                    <div className="pt-2 border-t border-amber-200/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-600">
                          السعة الكلية: <strong className="text-slate-900">{eventDetail.seatsCapacity}</strong>
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-600">
                          المحجوز: <strong className="text-slate-900">{eventDetail.seatsBooked}</strong>
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className={`font-bold ${eventDetail.seatsLeft > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          المقاعد المتبقية: {eventDetail.seatsLeft}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Event Registration / Cancellation Action Panel */}
                  <div className="pt-3 border-t border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {eventDetail?.isRegisteredByMe ? (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold">
                          <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>أنت مسجل في هذه الفعالية. مقعدك محجوز بنجاح.</span>
                        </div>

                        {!showCancelConfirm ? (
                          <button
                            type="button"
                            onClick={() => setShowCancelConfirm(true)}
                            disabled={isActionPending}
                            className="px-3.5 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            إلغاء التسجيل
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-600 font-medium">تأكيد الإلغاء؟</span>
                            <button
                              type="button"
                              onClick={handleCancelRegistration}
                              disabled={isActionPending}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              {isActionPending && <Loader2 className="w-3 h-3 animate-spin" />}
                              <span>نعم، إلغاء</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCancelConfirm(false)}
                              disabled={isActionPending}
                              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded transition-colors cursor-pointer"
                            >
                              تراجع
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs text-slate-600">
                          {eventDetail?.isFullyBooked
                            ? 'عذراً، اكتملت سعة المقاعد المتاحة لهذه الفعالية.'
                            : 'التسجيل يمنحك شهادة حضور رقمية ورابط البث المباشر.'}
                        </span>

                        <button
                          type="button"
                          onClick={handleRegister}
                          disabled={isActionPending || (eventDetail ? eventDetail.isFullyBooked : false)}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer ${
                            eventDetail?.isFullyBooked
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-[#D4AF37] hover:bg-[#c29e2f] text-[#0B3D5B] shadow-2xs'
                          } disabled:opacity-50`}
                        >
                          {isActionPending ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>جاري التسجيل...</span>
                            </>
                          ) : eventDetail?.isFullyBooked ? (
                            <span>اكتملت المقاعد</span>
                          ) : (
                            <>
                              <Users className="w-3.5 h-3.5" />
                              <span>التسجيل في الفعالية</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-[#0B3D5B] mb-2">الوصف والمحاور:</h4>
                <p className="text-slate-600 leading-relaxed whitespace-pre-line text-xs sm:text-sm">
                  {activeItem.description}
                </p>
              </div>

              {/* Views and metadata footer */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                {activeItem.author && activeItem.author.name && (
                  <span>
                    إعداد: <strong className="text-slate-800 font-semibold">{activeItem.author.name}</strong>
                    {activeItem.author.role ? ` (${activeItem.author.role})` : ''}
                  </span>
                )}
                {activeItem.date && (
                  <span>تاريخ النشر: {activeItem.date}</span>
                )}
                {typeof activeItem.readsOrViews === 'number' && (
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeItem.readsOrViews} مشاهدة</span>
                  </span>
                )}
              </div>
            </>
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
            <span>{liked ? 'تم الإعجاب' : 'إعجاب'}</span>
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
