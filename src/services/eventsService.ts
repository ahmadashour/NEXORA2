/**
 * NEXORA Events Service
 * Connects frontend Event components to the approved /api/v1/events REST routes.
 * Phase 5 / P1.4.6 Architecture.
 */

import { apiGet, apiPost, apiDelete, ApiError } from './apiClient';
import {
  adaptEventDetailFromBackend,
  adaptEventsList,
} from './adapters/eventsAdapter';
import {
  adaptContentItemFromBackend,
  adaptContentItemsList,
} from './adapters/contentAdapter';
import {
  BackendContentItemDTO,
  BackendEventDetailDTO,
  EventDetailViewModel,
  UnifiedContentViewModel,
  ApiPaginationMeta,
  RegisterEventResult,
} from '../types/contracts';

export { ApiError };

export interface FetchEventsParams {
  page?: number;
  limit?: number;
  subject?: string;
  grade_level?: string;
  search?: string;
}

export interface FetchEventsResult {
  items: UnifiedContentViewModel[];
  pagination: ApiPaginationMeta;
}

export interface EventDetailResult {
  event: EventDetailViewModel;
  content?: UnifiedContentViewModel;
}

export const eventsService = {
  /**
   * Fetches published events list with optional subject, grade level, search query, and pagination.
   */
  async getEventsList(
    params: FetchEventsParams = {},
    endpointOverride?: string
  ): Promise<FetchEventsResult> {
    const endpoint = endpointOverride || '/events';
    const queryParams: Record<string, any> = {};

    if (params.page !== undefined) queryParams.page = params.page;
    if (params.limit !== undefined) queryParams.limit = params.limit;
    if (params.subject && params.subject !== 'all') queryParams.subject = params.subject;
    if (params.grade_level) queryParams.grade_level = params.grade_level;
    if (params.search && params.search.trim()) queryParams.search = params.search.trim();

    const res = await apiGet<{
      success: boolean;
      data: BackendContentItemDTO[];
      pagination: ApiPaginationMeta;
    }>(endpoint, { params: queryParams });

    return {
      items: adaptContentItemsList(res.data || []),
      pagination: res.pagination || {
        total: (res.data || []).length,
        page: params.page || 1,
        limit: params.limit || 10,
        totalPages: 1,
        hasMore: false,
      },
    };
  },

  /**
   * Fetches single event details by event ID or attached content item ID.
   */
  async getEventById(
    id: string,
    endpointOverride?: string
  ): Promise<EventDetailResult> {
    const endpoint = endpointOverride || `/events/${encodeURIComponent(id)}`;
    const res = await apiGet<{
      success: boolean;
      event: BackendEventDetailDTO;
      content?: BackendContentItemDTO;
    }>(endpoint);

    const adaptedEvent = adaptEventDetailFromBackend(res.event);
    const adaptedContent = res.content ? adaptContentItemFromBackend(res.content) : undefined;

    return {
      event: adaptedEvent,
      content: adaptedContent,
    };
  },

  /**
   * Registers the authenticated user for an event atomically.
   * Enforces backend seat capacity checks and duplicate registration prevention.
   */
  async registerForEvent(
    id: string,
    notes?: string,
    endpointOverride?: string
  ): Promise<RegisterEventResult> {
    const endpoint = endpointOverride || `/events/${encodeURIComponent(id)}/register`;
    const res = await apiPost<{
      success: boolean;
      message: string;
      registration: {
        id: string;
        event_id: string;
        user_id: string;
        status: string;
        created_at: string;
      };
    }>(endpoint, notes ? { notes } : {});

    return {
      success: true,
      message: res.message || 'تم تأكيد تسجيلك في الفعالية بنجاح',
      registrationId: res.registration?.id,
      eventContentId: id,
      registeredAt: res.registration?.created_at,
    };
  },

  /**
   * Cancels the authenticated user's registration and frees the seat atomically.
   */
  async cancelRegistration(
    id: string,
    endpointOverride?: string
  ): Promise<{ success: boolean; message: string }> {
    const endpoint = endpointOverride || `/events/${encodeURIComponent(id)}/register`;
    const res = await apiDelete<{
      success: boolean;
      message: string;
    }>(endpoint);

    return {
      success: true,
      message: res.message || 'تم إلغاء التسجيل في الفعالية بنجاح',
    };
  },
};
