/**
 * useLibrary Hook
 * Manages fetching, filtering, and safe download execution for Library resources.
 * Phase 5 / P1.4.4 Architecture.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { LibraryResourceViewModel, ApiPaginationMeta } from '../types/contracts';
import { libraryService, FetchLibraryParams, ApiError } from '../services/libraryService';

export interface UseLibraryOptions {
  autoFetch?: boolean;
  initialSubject?: string;
  initialSearch?: string;
  limit?: number;
}

export function useLibrary(options: UseLibraryOptions = {}) {
  const {
    autoFetch = true,
    initialSubject = 'all',
    initialSearch = '',
    limit = 20,
  } = options;

  const [resources, setResources] = useState<LibraryResourceViewModel[]>([]);
  const [pagination, setPagination] = useState<ApiPaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubject);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);

  // Download state & mutex locks
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadInProgress, setDownloadInProgress] = useState<Record<string, boolean>>({});

  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadResources = useCallback(
    async (params?: FetchLibraryParams) => {
      setIsLoading(true);
      setError(null);

      const effectiveSubject = params?.subject !== undefined ? params.subject : selectedSubject;
      const effectiveSearch = params?.search !== undefined ? params.search : searchQuery;

      try {
        const result = await libraryService.getResources({
          limit,
          subject: effectiveSubject,
          search: effectiveSearch,
          ...params,
        });

        if (!isMountedRef.current) return;

        setResources(result.resources);
        setPagination(result.pagination);
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        const msg = err instanceof ApiError ? err.message : 'تعذر تحميل مصادر المكتبة الرقمية من الخادم';
        setError(msg);
        // Strictly never fallback to mock data as real data!
        setResources([]);
        setPagination(null);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [limit, selectedSubject, searchQuery]
  );

  useEffect(() => {
    if (autoFetch) {
      loadResources();
    }
  }, [autoFetch, loadResources]);

  const handleDownload = useCallback(
    async (resource: LibraryResourceViewModel): Promise<{ success: boolean; downloadUrl?: string; message?: string }> => {
      const resourceId = resource.id;

      // Concurrency lock: prevent duplicate clicks on any download in progress
      if (downloadInProgress[resourceId] || downloadingId !== null) {
        return {
          success: false,
          message: 'عملية تنزيل أخرى قيد المعالجة حالياً',
        };
      }

      setDownloadingId(resourceId);
      setDownloadInProgress((prev) => ({ ...prev, [resourceId]: true }));
      setDownloadError(null);
      setDownloadSuccessMessage(null);

      try {
        const downloadData = await libraryService.downloadResource(resourceId);

        if (!isMountedRef.current) {
          return { success: true, downloadUrl: downloadData.downloadUrl };
        }

        // Increment downloads counter locally to reflect confirmed server state
        setResources((prev) =>
          prev.map((r) =>
            r.id === resourceId ? { ...r, downloadsCount: downloadData.downloadsCount } : r
          )
        );

        const successMsg = `تم تجهيز ملف "${resource.title}" بنجاح (${downloadData.fileType} · ${resource.fileSizeFormatted})`;
        setDownloadSuccessMessage(successMsg);

        // In browser environment, initiate download safely
        if (typeof window !== 'undefined' && downloadData.downloadUrl) {
          try {
            const anchor = document.createElement('a');
            anchor.href = downloadData.downloadUrl;
            anchor.download = downloadData.fileName || `${resource.title}.${downloadData.fileType.toLowerCase()}`;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
          } catch {
            // Ignore DOM errors in non-browser/test environments
          }
        }

        return {
          success: true,
          downloadUrl: downloadData.downloadUrl,
          message: successMsg,
        };
      } catch (err: unknown) {
        if (!isMountedRef.current) {
          return { success: false, message: 'فشل التنزيل' };
        }

        const msg = err instanceof ApiError ? err.message : 'تعذر تحميل المورد من الخادم';
        setDownloadError(msg);
        return {
          success: false,
          message: msg,
        };
      } finally {
        if (isMountedRef.current) {
          setDownloadingId(null);
          setDownloadInProgress((prev) => ({ ...prev, [resourceId]: false }));
        }
      }
    },
    [downloadInProgress, downloadingId]
  );

  const clearMessages = useCallback(() => {
    setDownloadSuccessMessage(null);
    setDownloadError(null);
  }, []);

  return {
    resources,
    pagination,
    isLoading,
    error,
    selectedSubject,
    setSelectedSubject,
    searchQuery,
    setSearchQuery,
    downloadingId,
    downloadInProgress,
    downloadSuccessMessage,
    downloadError,
    loadResources,
    handleDownload,
    clearMessages,
  };
}
