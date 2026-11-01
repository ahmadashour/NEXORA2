/**
 * Support & Inquiries Data Adapter
 * Converts between Frontend Contact Modal forms and Backend Support DTOs.
 * Phase 5 / P1.4.9 Architecture.
 */

import {
  BackendContactInquiryDTO,
  BackendSupportInquiry,
  SupportInquiryPayload,
  SupportInquiryUI,
  BackendInquiryStatus,
} from '../../types/contracts';
import { formatArabicDate } from './communityAdapter';

export interface FrontendInquiryInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  phone?: string;
  portalCode?: string;
}

export interface AdaptedInquiryResponse {
  id: string;
  status: string;
  createdAt: string;
  fullName: string;
  email: string;
  subject: string;
  message: string;
  phone?: string | null;
  portalCode?: string | null;
}

/**
 * Transforms frontend contact form input into backend SupportInquiryPayload.
 * Note: Maps frontend 'name' to backend 'full_name' and 'portalCode' to 'portal_code' (uppercase).
 */
export function transformContactFormData(input: FrontendInquiryInput): SupportInquiryPayload {
  return {
    full_name: input.name?.trim() || '',
    email: input.email?.trim().toLowerCase() || '',
    subject: input.subject?.trim() || '',
    message: input.message?.trim() || '',
    phone: input.phone?.trim() || null,
    portal_code: input.portalCode ? input.portalCode.trim().toUpperCase() : null,
  };
}

/**
 * Transforms frontend contact form input into backend CreateInquiryPayload (P1.4.2 specification).
 * Note: Preserves portalCode exact casing.
 */
export function adaptCreateInquiryPayload(input: FrontendInquiryInput): CreateInquiryPayload {
  return {
    full_name: input.name?.trim() || '',
    email: input.email?.trim().toLowerCase() || '',
    subject: input.subject?.trim() || '',
    message: input.message?.trim() || '',
    phone: input.phone?.trim() || null,
    portal_code: input.portalCode?.trim() || null,
  };
}

/**
 * Maps inquiry status to localized Arabic string.
 */
export function mapInquiryStatusToArabic(status: string): string {
  switch (status) {
    case 'received':
      return 'تم الاستلام';
    case 'in_progress':
      return 'قيد المتابعة';
    case 'resolved':
      return 'تم الحل';
    case 'closed':
      return 'مغلق';
    default:
      return 'تم الاستلام';
  }
}

/**
 * Returns Tailwind CSS color badge classes for inquiry status.
 */
export function getInquiryStatusColor(status: string): string {
  switch (status) {
    case 'received':
      return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
    case 'in_progress':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    case 'resolved':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'closed':
      return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    default:
      return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
  }
}

/**
 * Maps backend error codes to clear educational Arabic notices.
 */
export function mapSupportErrorToArabic(errorCode?: string, defaultMessage?: string): string {
  switch (errorCode) {
    case 'VALIDATION_FAILED':
      return 'يرجى ملء جميع الحقول الإجبارية بالشكل الصحيح.';
    case 'INVALID_EMAIL_FORMAT':
      return 'صيغة البريد الإلكتروني غير صحيحة، يرجى كتابة بريد صالح.';
    case 'FORBIDDEN_IDOR':
      return 'لا تملك صلاحية للاطلاع على هذا الاستفسار.';
    case 'RATE_LIMIT_EXCEEDED':
      return 'تجاوزت الحد المسموح من الطلبات، يرجى الانتظار قليلاً.';
    case 'MESSAGE_TOO_SHORT':
      return 'الرسالة قصيرة جداً، يرجى كتابة 5 أحرف على الأقل.';
    case 'INVALID_NAME':
      return 'الاسم قصير جداً، يرجى كتابة حرفين على الأقل.';
    case 'UNAUTHORIZED':
      return 'يجب تسجيل الدخول أولاً للوصول إلى هذه البيانات.';
    case 'FORBIDDEN':
      return 'ليس لديك الصلاحية لتنفيذ هذا الإجراء.';
    case 'INQUIRY_NOT_FOUND':
      return 'لم يتم العثور على الاستفسار المطلوب.';
    case 'INVALID_STATUS':
      return 'حالة الاستفسار المحددة غير صالحة.';
    case 'DATABASE_UNAVAILABLE':
      return 'قاعدة البيانات غير متاحة حالياً، يرجى المحاولة لاحقاً.';
    case 'SERVER_ERROR':
      return 'حدث خطأ في الخادم، يرجى المحاولة لاحقاً.';
    default:
      return defaultMessage || 'حدث خطأ أثناء معالجة طلب الدعم.';
  }
}

/**
 * Transforms backend inquiry DTO into frontend SupportInquiryUI view model.
 */
export function backendToUiInquiry(dto: BackendSupportInquiry | BackendContactInquiryDTO): SupportInquiryUI {
  const status = (dto.status || 'received') as BackendInquiryStatus;
  return {
    id: dto.id,
    userId: dto.user_id || null,
    fullName: dto.full_name,
    email: dto.email,
    phone: dto.phone || null,
    subject: dto.subject,
    message: dto.message,
    portalCode: dto.portal_code || null,
    status,
    statusArabic: mapInquiryStatusToArabic(status),
    statusColor: getInquiryStatusColor(status),
    adminNotes: (dto as any).admin_notes || (dto as any).resolution_notes || null,
    assignedTo: (dto as any).assigned_to || null,
    createdAt: dto.created_at,
    date: formatArabicDate(dto.created_at),
  };
}

/**
 * Backward compatibility alias for backendToUiInquiry.
 */
export function adaptInquiryResponse(dto: BackendContactInquiryDTO): AdaptedInquiryResponse {
  return {
    id: dto.id,
    status: dto.status || 'received',
    createdAt: formatArabicDate(dto.created_at),
    fullName: dto.full_name,
    email: dto.email,
    subject: dto.subject,
    message: dto.message,
    phone: dto.phone,
    portalCode: dto.portal_code,
  };
}
