/**
 * Library Data Adapter
 * Converts between Backend DTOs and Frontend View Models for Digital Library Resources.
 * Phase 5 / P1.4.2 Architecture.
 */

import {
  BackendLibraryResourceDTO,
  LibraryResourceViewModel,
} from '../../types/contracts';
import { formatArabicDate } from './communityAdapter';

/**
 * Formats raw byte counts into human-readable size units.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes <= 0) {
    return '1.5 MB'; // clean fallback default
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Ensures safe, public download URL without leaking server internal filesystem paths.
 */
export function sanitizeDownloadUrl(resourceId: string, rawUrl?: string | null): string {
  // If the raw URL contains dangerous filesystem indicators, sanitize to clean API route
  if (!rawUrl || rawUrl.startsWith('/') || rawUrl.includes('/uploads/') || rawUrl.includes('disk:')) {
    return `/api/v1/library/resources/${resourceId}/download`;
  }
  return rawUrl;
}

/**
 * Transforms a single BackendLibraryResourceDTO into the Frontend LibraryResourceViewModel.
 */
export function adaptLibraryResourceFromBackend(dto: BackendLibraryResourceDTO): LibraryResourceViewModel {
  const fileType = (dto.file_type || 'PDF').toUpperCase();
  const fileSizeFormatted = formatBytes(dto.file_size_bytes);

  return {
    id: dto.id,
    title: dto.title || '',
    description: dto.description || '',
    category: dto.category || 'عام',
    subject: dto.subject || 'علوم عامة',
    grade: dto.grade_level || 'المرحلة الثانوية',
    publisher: dto.publisher_name || 'شبكة نكسورا التعليمية',
    downloadUrl: sanitizeDownloadUrl(dto.id, dto.file_url),
    fileSizeFormatted,
    fileType,
    mimeType: dto.mime_type || 'application/pdf',
    downloadsCount: Number(dto.downloads_count) || 0,
    viewsCount: Number(dto.views_count) || 0,
    publishedDate: formatArabicDate(dto.created_at),
  };
}

/**
 * Transforms an array of backend library resource DTOs.
 */
export function adaptLibraryResourcesList(dtos: BackendLibraryResourceDTO[]): LibraryResourceViewModel[] {
  if (!Array.isArray(dtos)) return [];
  return dtos.map(adaptLibraryResourceFromBackend);
}
