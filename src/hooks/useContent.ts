/**
 * useContent Hook
 * Manages fetching, filtering, and UI states for NEXORA Content items.
 * Phase 5 / P1.4.5 Architecture.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { UnifiedContentViewModel, ApiPaginationMeta } from '../types/contracts';
import { contentService, FetchContentParams, ApiError } from '../services/contentService';
import { eventsService } from '../services/eventsService';
import { LATEST_CONTENT } from '../data/mockData';
import { ContentItem } from '../types';

export type ContentTabCategory = 'all' | 'resource' | 'video' | 'news' | 'event';

export interface UseContentOptions {
  autoFetch?: boolean;
  initialTab?: ContentTabCategory;
  limit?: number;
}

export function useContent(options: UseContentOptions = {}) {
  const {
    autoFetch = true,
    initialTab = 'all',
    limit = 10,
  } = options;

  const [items, setItems] = useState<UnifiedContentViewModel[]>([]);
  const [pagination, setPagination] = useState<ApiPaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ContentTabCategory>(initialTab);

  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Maps UI tab category to backend content category query parameter.
   * 'resource' in UI maps to 'article' in Backend Content API.
   * 'video' maps to 'video'.
   * 'news' maps to 'news'.
   * 'all' queries all content without category filter.
   */
  const mapTabToBackendCategory = (tab: ContentTabCategory): FetchContentParams['category'] | undefined => {
    switch (tab) {
      case 'resource':
        return 'article';
      case 'video':
        return 'video';
      case 'news':
        return 'news';
      case 'all':
      default:
        return undefined;
    }
  };

  const loadContent = useCallback(
    async (tabToLoad: ContentTabCategory = activeTab) => {
      // Phase 5 / P1.4.6: Events Integration
      // When 'event' tab is active, fetch live events directly from Events API
      if (tabToLoad === 'event') {
        setIsLoading(true);
        setError(null);
        try {
          const result = await eventsService.getEventsList({ limit });
          if (isMountedRef.current) {
            setItems(result.items);
            setPagination(result.pagination);
          }
        } catch (err: unknown) {
          if (!isMountedRef.current) return;
          let errorMsg = 'تعذر الاتصال بالخادم لجلب الفعاليات المجدولة';
          if (err instanceof ApiError) {
            errorMsg = err.message || errorMsg;
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
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const backendCategory = mapTabToBackendCategory(tabToLoad);
        const result = await contentService.getContentList({
          limit,
          category: backendCategory,
          status: 'published',
        });

        if (!isMountedRef.current) return;

        setItems(result.items);
        setPagination(result.pagination);
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        const msg = err instanceof ApiError ? err.message : 'تعذر تحميل المحتوى التعليمي من خادم المنصة';
        setError(msg);
        // Strictly isolated: Never fallback silently to mock data on network/server errors
        setItems([]);
        setPagination(null);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [activeTab, limit]
  );

  useEffect(() => {
    if (autoFetch) {
      loadContent(activeTab);
    }
  }, [activeTab, autoFetch, loadContent]);

  const switchTab = useCallback((tab: ContentTabCategory) => {
    setActiveTab(tab);
  }, []);

  const reload = useCallback(() => {
    return loadContent(activeTab);
  }, [activeTab, loadContent]);

  return {
    items,
    pagination,
    isLoading,
    error,
    activeTab,
    switchTab,
    reload,
  };
}
