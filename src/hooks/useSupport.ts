/**
 * NEXORA useSupport Hook
 * State management for submitting contact inquiries, viewing inquiry history,
 * and managing inquiry lifecycles for authorized personnel.
 */

import { useState, useCallback } from 'react';
import {
  SupportInquiryUI,
  SupportInquiryPayload,
  InquiryFilters,
  EventPagination,
  BackendInquiryStatus,
} from '../types/contracts';
import { supportService, SupportApiError } from '../services/supportService';
import { transformContactFormData } from '../services/adapters/supportAdapter';

export function useSupport() {
  const [inquiries, setInquiries] = useState<SupportInquiryUI[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<EventPagination>({
    total: 0,
    page: 1,
    limit: 15,
    totalPages: 1,
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  /**
   * Submits a contact inquiry
   */
  const submitInquiry = useCallback(
    async (formData: {
      name: string;
      email: string;
      subject: string;
      message: string;
      phone?: string;
      portalCode?: string;
    }): Promise<{ success: boolean; message: string }> => {
      // Client-side quick check
      if (!formData.name.trim() || !formData.email.trim() || !formData.subject.trim() || !formData.message.trim()) {
        const msg = 'يرجى ملء جميع الحقول الإجبارية (الاسم، البريد، الموضوع، والرسالة).';
        setActionError(msg);
        return { success: false, message: msg };
      }

      if (formData.name.trim().length < 2) {
        const msg = 'الاسم يجب أن يتكون من حرفين على الأقل.';
        setActionError(msg);
        return { success: false, message: msg };
      }

      if (formData.message.trim().length < 5) {
        const msg = 'يرجى كتابة رسالة واضحة تحتوي على 5 أحرف على الأقل.';
        setActionError(msg);
        return { success: false, message: msg };
      }

      setIsSubmitting(true);
      setActionError(null);
      setActionSuccess(null);

      try {
        const payload: SupportInquiryPayload = transformContactFormData(formData);
        const res = await supportService.submitInquiry(payload);
        setActionSuccess(res.message);
        return { success: true, message: res.message };
      } catch (err: unknown) {
        const msg = err instanceof SupportApiError ? err.message : 'فشل إرسال الاستفسار، يرجى المحاولة لاحقاً';
        setActionError(msg);
        return { success: false, message: msg };
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  /**
   * Fetches user's inquiries (or all for supervisor)
   */
  const fetchInquiries = useCallback(async (filters: InquiryFilters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await supportService.getInquiries(filters);
      setInquiries(res.inquiries);
      setPagination(res.pagination);
    } catch (err: unknown) {
      const msg = err instanceof SupportApiError ? err.message : 'فشل استرجاع الاستفسارات';
      setError(msg);
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Updates inquiry status (Supervisors only)
   */
  const updateStatus = useCallback(
    async (
      id: string,
      status: BackendInquiryStatus,
      adminNotes?: string,
      assignedTo?: string
    ): Promise<{ success: boolean; message: string }> => {
      setIsSubmitting(true);
      setActionError(null);
      setActionSuccess(null);

      try {
        const res = await supportService.updateInquiryStatus(id, {
          status,
          admin_notes: adminNotes,
          assigned_to: assignedTo,
        });

        // Update local state atomically
        setInquiries((prev) =>
          prev.map((inq) => (inq.id === id ? { ...inq, status, adminNotes, assignedTo } : inq))
        );

        setActionSuccess(res.message);
        return { success: true, message: res.message };
      } catch (err: unknown) {
        const msg = err instanceof SupportApiError ? err.message : 'فشل تحديث حالة الاستفسار';
        setActionError(msg);
        return { success: false, message: msg };
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return {
    inquiries,
    loading,
    error,
    pagination,
    isSubmitting,
    actionError,
    actionSuccess,
    submitInquiry,
    fetchInquiries,
    updateStatus,
    clearFeedback: () => {
      setActionError(null);
      setActionSuccess(null);
    },
  };
}
