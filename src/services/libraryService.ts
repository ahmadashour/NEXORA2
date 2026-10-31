/**
 * NEXORA Library Service
 * Connects frontend Library components to the approved /api/v1/library REST routes.
 * Phase 5 / P1.4.4 Architecture.
 */

import { apiGet, apiPost, ApiError } from './apiClient';
import {
  adaptLibraryResourceFromBackend,
  adaptLibraryResourcesList,
  sanitizeDownloadUrl,
} from './adapters/libraryAdapter';
import {
  BackendLibraryResourceDTO,
  LibraryResourceViewModel,
  ApiPaginationMeta,
} from '../types/contracts';

export interface FetchLibraryParams {
  page?: number;
  limit?: number;
  subject?: string;
  grade_level?: string;
  search?: string;
  category?: string;
  status?: string;
}

export interface FetchLibraryResult {
  resources: LibraryResourceViewModel[];
  pagination: ApiPaginationMeta;
}

export interface DownloadResourceResult {
  downloadUrl: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  downloadsCount: number;
  message: string;
}

export const libraryService = {
  /**
   * Fetches published library resources with optional filtering and pagination
   */
  async getResources(params: FetchLibraryParams = {}, endpointOverride?: string): Promise<FetchLibraryResult> {
    const endpoint = endpointOverride || '/library/resources';
    const res = await apiGet<{
      success: boolean;
      data: BackendLibraryResourceDTO[];
      pagination: ApiPaginationMeta;
    }>(endpoint, {
      params: {
        page: params.page,
        limit: params.limit,
        subject: params.subject === 'all' ? undefined : params.subject,
        grade_level: params.grade_level,
        search: params.search?.trim() || undefined,
        category: params.category,
        status: params.status,
      },
    });

    return {
      resources: adaptLibraryResourcesList(res.data),
      pagination: res.pagination,
    };
  },

  /**
   * Fetches single resource metadata by ID
   */
  async getResourceById(id: string, endpointOverride?: string): Promise<LibraryResourceViewModel> {
    const endpoint = endpointOverride || `/library/resources/${encodeURIComponent(id)}`;
    const res = await apiGet<{
      success: boolean;
      resource: BackendLibraryResourceDTO;
    }>(endpoint);

    return adaptLibraryResourceFromBackend(res.resource);
  },

  /**
   * Requests safe download URL and increments download counter on the server
   */
  async downloadResource(id: string, endpointOverride?: string): Promise<DownloadResourceResult> {
    const endpoint = endpointOverride || `/library/resources/${encodeURIComponent(id)}/download`;
    const res = await apiPost<{
      success: boolean;
      message: string;
      downloadUrl: string;
      fileName: string;
      fileType: string;
      fileSizeBytes: number;
      downloadsCount: number;
    }>(endpoint, {});

    // Ensure raw file path is sanitized to protect server internal filesystem
    const sanitizedUrl = sanitizeDownloadUrl(id, res.downloadUrl);

    return {
      downloadUrl: sanitizedUrl,
      fileName: res.fileName || '',
      fileType: res.fileType || 'PDF',
      fileSizeBytes: res.fileSizeBytes || 0,
      downloadsCount: typeof res.downloadsCount === 'number' ? res.downloadsCount : 0,
      message: res.message || 'تم بدء التنزيل بنجاح',
    };
  },
};

export { ApiError };
