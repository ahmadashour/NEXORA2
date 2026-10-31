/**
 * useEvents Hook
 * Manages fetching, registration, cancellation, and UI states for NEXORA Events.
 * Phase 5 / P1.4.6 Architecture.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { UnifiedContentViewModel, ApiPaginationMeta, RegisterEventResult } from '../types/contracts';
import { eventsService, FetchEventsParams, ApiError } from '../services/eventsService';

export interface UseEventsOptions {
  autoFetch?: boolean;
  limit?: number;
  subject?: string;
  grade_level?: string;
  search?: string;
}

export function useEvents(options: UseEventsOptions = {}) {
  const {
    autoFetch = true,
    limit = 10,
    subject,
    grade_level,
    search,
  } = options;

  const [items, setItems] = useState<UnifiedContentViewModel[]>([]);
  const [pagination, setPagination] = useState<ApiPaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isActionPending, setIsActionPending] = useState<boolean>(false);

  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchEvents = useCallback(
    async (params: FetchEventsParams = {}) => {
      setIsLoading(true);
      setError(null);

      try {
        const queryParams: FetchEventsParams = {
          limit,
          subject,
          grade_level,
          search,
          ...params,
        };

        const result = await eventsService.getEventsList(queryParams);

        if (isMountedRef.current) {
          setItems(result.items);
          setPagination(result.pagination);
        }
      } catch (err: unknown) {
        if (!isMountedRef.current) return;

        let errorMsg = 'تعذر الاتصال بالخادم لجلب الفعاليات الأكاديمية';
        if (err instanceof ApiError) {
          if (err.status === 503) {
            errorMsg = 'قاعدة البيانات الدائمة غير متوفرة حالياً';
          } else {
            errorMsg = err.message || errorMsg;
          }
        } else if (err instanceof Error) {
          errorMsg = err.message;
        }

        setError(errorMsg);
        setItems([]);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [limit, subject, grade_level, search]
  );

  useEffect(() => {
    if (autoFetch) {
      fetchEvents();
    }
  }, [autoFetch, fetchEvents]);

  const reload = useCallback(async () => {
    await fetchEvents();
  }, [fetchEvents]);

  /**
   * Registers user for an event with mutex lock protection
   */
  const register = useCallback(
    async (eventId: string, notes?: string): Promise<RegisterEventResult> => {
      if (isActionPending) {
        throw new Error('جاري تنفيذ طلب آخر، يرجى الانتظار');
      }

      setIsActionPending(true);
      try {
        const res = await eventsService.registerForEvent(eventId, notes);
        // Refresh event list to update seat count atomically
        await fetchEvents();
        return res;
      } finally {
        if (isMountedRef.current) {
          setIsActionPending(false);
        }
      }
    },
    [isActionPending, fetchEvents]
  );

  /**
   * Cancels user registration for an event with mutex lock protection
   */
  const cancelRegistration = useCallback(
    async (eventId: string): Promise<{ success: boolean; message: string }> => {
      if (isActionPending) {
        throw new Error('جاري تنفيذ طلب آخر، يرجى الانتظار');
      }

      setIsActionPending(true);
      try {
        const res = await eventsService.cancelRegistration(eventId);
        // Refresh event list to reflect updated seat count
        await fetchEvents();
        return res;
      } finally {
        if (isMountedRef.current) {
          setIsActionPending(false);
        }
      }
    },
    [isActionPending, fetchEvents]
  );

  return {
    items,
    pagination,
    isLoading,
    error,
    isActionPending,
    fetchEvents,
    reload,
    register,
    cancelRegistration,
  };
}
