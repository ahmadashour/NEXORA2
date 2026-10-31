/**
 * NEXORA Content Service
 * Connects frontend Content components to the approved /api/v1/content REST routes.
 * Phase 5 / P1.4.5 Architecture.
 */

import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from './apiClient';
import {
  adaptContentItemFromBackend,
  adaptContentItemsList,
} from './adapters/contentAdapter';
import {
  BackendContentItemDTO,
  UnifiedContentViewModel,
  ApiPaginationMeta,
} from '../types/contracts';

export interface FetchContentParams {
  page?: number;
  limit?: number;
  category?: 'article' | 'video' | 'news' | 'event' | 'announcement';
  subject?: string;
  grade_level?: string;
  featured?: boolean;
  search?: string;
  status?: 'draft' | 'review' | 'published' | 'archived';
}

export interface FetchContentResult {
  items: UnifiedContentViewModel[];
  pagination: ApiPaginationMeta;
}

export const contentService = {
  /**
   * Fetches published content items with optional category, subject, search, and pagination.
   */
  async getContentList(
    params: FetchContentParams = {},
    endpointOverride?: string
  ): Promise<FetchContentResult> {
    const endpoint = endpointOverride || '/content';
    const queryParams: Record<string, any> = {};

    if (params.page !== undefined) queryParams.page = params.page;
    if (params.limit !== undefined) queryParams.limit = params.limit;
    if (params.category) queryParams.category = params.category;
    if (params.subject && params.subject !== 'all') queryParams.subject = params.subject;
    if (params.grade_level) queryParams.grade_level = params.grade_level;
    if (params.featured !== undefined) queryParams.featured = params.featured;
    if (params.search && params.search.trim()) queryParams.search = params.search.trim();
    if (params.status) queryParams.status = params.status;

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
   * Fetches a single content item by ID.
   */
  async getContentById(
    id: string,
    endpointOverride?: string
  ): Promise<UnifiedContentViewModel> {
    const endpoint = endpointOverride || `/content/${encodeURIComponent(id)}`;
    const res = await apiGet<{
      success: boolean;
      content: BackendContentItemDTO;
    }>(endpoint);

    return adaptContentItemFromBackend(res.content);
  },

  /**
   * Creates a new content item (Restricted to authorized leadership roles: LEAD, PRO).
   */
  async createContent(
    payload: {
      title: string;
      description: string;
      category: 'article' | 'video' | 'news' | 'event' | 'announcement';
      subject?: string;
      grade_level?: string;
      thumbnail_url?: string;
      video_url?: string;
      read_time_minutes?: number;
      featured?: boolean;
      status?: 'draft' | 'review' | 'published';
    },
    endpointOverride?: string
  ): Promise<UnifiedContentViewModel> {
    const endpoint = endpointOverride || '/content';
    const res = await apiPost<{
      success: boolean;
      message: string;
      content: BackendContentItemDTO;
    }>(endpoint, payload);

    return adaptContentItemFromBackend(res.content);
  },

  /**
   * Updates an existing content item (Restricted to author or authorized leadership).
   */
  async updateContent(
    id: string,
    updates: Partial<{
      title: string;
      description: string;
      category: 'article' | 'video' | 'news' | 'event' | 'announcement';
      subject: string;
      grade_level: string;
      thumbnail_url: string;
      video_url: string;
      read_time_minutes: number;
      featured: boolean;
      status: 'draft' | 'review' | 'published' | 'archived';
    }>,
    endpointOverride?: string
  ): Promise<UnifiedContentViewModel> {
    const endpoint = endpointOverride || `/content/${encodeURIComponent(id)}`;
    const res = await apiPatch<{
      success: boolean;
      message: string;
      content: BackendContentItemDTO;
    }>(endpoint, updates);

    return adaptContentItemFromBackend(res.content);
  },

  /**
   * Soft deletes a content item (sets status to archived).
   */
  async deleteContent(
    id: string,
    endpointOverride?: string
  ): Promise<{ success: boolean; message: string }> {
    const endpoint = endpointOverride || `/content/${encodeURIComponent(id)}`;
    return apiDelete<{ success: boolean; message: string }>(endpoint);
  },
};

export { ApiError };
