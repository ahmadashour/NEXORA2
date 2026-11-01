/**
 * NEXORA Support Service
 * Connects frontend components to the backend Support REST API (/api/v1/support/inquiries).
 * Enforces validation, CSRF protection, credentials inclusion, and IDOR defense with zero mock fallback.
 */

import { apiClient } from './apiClient';
import {
  SupportInquiryPayload,
  BackendSupportInquiry,
  SupportInquiryUI,
  InquiryFilters,
  EventPagination,
  InquiriesApiResponse,
  SingleInquiryApiResponse,
  CreateInquiryApiResponse,
  UpdateInquiryStatusPayload,
} from '../types/contracts';
import { backendToUiInquiry, mapSupportErrorToArabic } from './adapters/supportAdapter';

const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

function getHeaders(includeContentType = true): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  const token = apiClient.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const csrf = apiClient.getCsrfToken();
  if (csrf) {
    headers['X-CSRF-Token'] = csrf;
  }

  return headers;
}

export class SupportApiError extends Error {
  statusCode: number;
  errorCode: string;

  constructor(message: string, statusCode = 500, errorCode = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'SupportApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export const supportService = {
  /**
   * Submits a new contact inquiry to backend (Guests & Authenticated users)
   */
  async submitInquiry(payload: SupportInquiryPayload): Promise<{ success: boolean; data?: BackendSupportInquiry; message: string }> {
    const res = await fetch(`${API_BASE}/support/inquiries`, {
      method: 'POST',
      headers: getHeaders(true),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const body: CreateInquiryApiResponse = await res.json();

    if (!res.ok || !body.success) {
      const errCode = body.error || (
        res.status === 400 ? 'VALIDATION_FAILED' :
        res.status === 429 ? 'RATE_LIMIT_EXCEEDED' :
        res.status === 503 ? 'DATABASE_UNAVAILABLE' : 'SERVER_ERROR'
      );
      const arabicMsg = mapSupportErrorToArabic(errCode, body.message || 'فشل إرسال الاستفسار');
      throw new SupportApiError(arabicMsg, res.status, errCode);
    }

    return {
      success: true,
      data: body.data,
      message: body.message || 'تم استلام استفسارك بنجاح وسيقوم فريق الدعم بالرد قريباً',
    };
  },

  /**
   * Fetches paginated inquiries for authenticated user (IDOR protected) or all for supervisors
   */
  async getInquiries(filters: InquiryFilters = {}): Promise<{ inquiries: SupportInquiryUI[]; pagination: EventPagination }> {
    const params = new URLSearchParams();
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.status) params.append('status', filters.status);
    if (filters.portal_code) params.append('portal_code', filters.portal_code);
    if (filters.search) params.append('search', filters.search);

    const qs = params.toString();
    const url = `${API_BASE}/support/inquiries${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders(false),
      credentials: 'include',
    });

    const data: InquiriesApiResponse = await res.json();

    if (!res.ok || !data.success) {
      const errCode = data.error || (
        res.status === 401 ? 'UNAUTHORIZED' :
        res.status === 403 ? 'FORBIDDEN' :
        res.status === 503 ? 'DATABASE_UNAVAILABLE' : 'SERVER_ERROR'
      );
      const arabicMsg = mapSupportErrorToArabic(errCode, data.message || 'فشل استرجاع الاستفسارات');
      throw new SupportApiError(arabicMsg, res.status, errCode);
    }

    const inquiries = (data.data || []).map(backendToUiInquiry);
    return {
      inquiries,
      pagination: data.pagination || {
        total: inquiries.length,
        page: filters.page || 1,
        limit: filters.limit || 15,
        totalPages: 1,
      },
    };
  },

  /**
   * Retrieves single inquiry details with IDOR verification
   */
  async getInquiryById(id: string): Promise<SupportInquiryUI> {
    const res = await fetch(`${API_BASE}/support/inquiries/${id}`, {
      method: 'GET',
      headers: getHeaders(false),
      credentials: 'include',
    });

    const data: SingleInquiryApiResponse = await res.json();

    if (!res.ok || !data.success || !data.data) {
      const errCode = data.error || (
        res.status === 403 ? 'FORBIDDEN_IDOR' :
        res.status === 404 ? 'INQUIRY_NOT_FOUND' : 'SERVER_ERROR'
      );
      const arabicMsg = mapSupportErrorToArabic(errCode, data.message || 'فشل استرجاع بيانات الاستفسار');
      throw new SupportApiError(arabicMsg, res.status, errCode);
    }

    return backendToUiInquiry(data.data);
  },

  /**
   * Updates inquiry status (Restricted to ADMIN, LEAD, PRO)
   */
  async updateInquiryStatus(id: string, payload: UpdateInquiryStatusPayload): Promise<{ success: boolean; data: BackendSupportInquiry; message: string }> {
    const res = await fetch(`${API_BASE}/support/inquiries/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(true),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const body = await res.json();

    if (!res.ok || !body.success) {
      const errCode = body.error || (
        res.status === 403 ? 'FORBIDDEN' :
        res.status === 404 ? 'INQUIRY_NOT_FOUND' : 'SERVER_ERROR'
      );
      const arabicMsg = mapSupportErrorToArabic(errCode, body.message || 'فشل تحديث حالة الاستفسار');
      throw new SupportApiError(arabicMsg, res.status, errCode);
    }

    return {
      success: true,
      data: body.data,
      message: body.message || 'تم تحديث حالة الاستفسار بنجاح',
    };
  },
};
