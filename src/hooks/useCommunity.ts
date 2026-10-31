/**
 * useCommunity Hook
 * Manages fetching, pagination, and interaction state for Community posts.
 * Phase 5 / P1.4.3 Architecture.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CommunityPost } from '../types';
import { ApiPaginationMeta } from '../types/contracts';
import { communityService } from '../services/communityService';
import { ApiError } from '../services/apiClient';

export interface UseCommunityOptions {
  autoFetch?: boolean;
  limit?: number;
}

export function useCommunity(options: UseCommunityOptions = {}) {
  const { autoFetch = true, limit = 10 } = options;

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [pagination, setPagination] = useState<ApiPaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interaction tracking state
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [likesCountMap, setLikesCountMap] = useState<Record<string, number>>({});
  const [savesCountMap, setSavesCountMap] = useState<Record<string, number>>({});

  // Concurrency guard: prevents rapid double clicks on likes/saves
  const [actionInProgress, setActionInProgress] = useState<Record<string, boolean>>({});
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadPosts = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await communityService.getPosts({ page, limit });
      if (!isMountedRef.current) return;

      setPosts(result.posts);
      setPagination(result.pagination);

      // Initialize interaction maps from server state
      const newLiked: Record<string, boolean> = {};
      const newSaved: Record<string, boolean> = {};
      const newLikesCount: Record<string, number> = {};
      const newSavesCount: Record<string, number> = {};

      result.posts.forEach((p) => {
        newLiked[p.id] = Boolean(p.isLiked);
        newSaved[p.id] = Boolean(p.isSaved);
        newLikesCount[p.id] = p.likes;
        newSavesCount[p.id] = p.saves;
      });

      setLikedMap(prev => ({ ...prev, ...newLiked }));
      setSavedMap(prev => ({ ...prev, ...newSaved }));
      setLikesCountMap(prev => ({ ...prev, ...newLikesCount }));
      setSavesCountMap(prev => ({ ...prev, ...newSavesCount }));
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const message = err instanceof ApiError ? err.message : 'تعذر تحميل منشورات المجتمع التعليمي من الخادم';
      setError(message);
      // Strictly do not fall back to mock data as real data!
      setPosts([]);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [limit]);

  useEffect(() => {
    if (autoFetch) {
      loadPosts(1);
    }
  }, [autoFetch, loadPosts]);

  // Listen to cross-component post events (creation/interactions)
  useEffect(() => {
    const handlePostCreated = (e: Event) => {
      const customEvent = e as CustomEvent<CommunityPost>;
      if (customEvent.detail && customEvent.detail.id) {
        setPosts(prev => {
          // Avoid duplicate insertion
          if (prev.some(p => p.id === customEvent.detail.id)) return prev;
          return [customEvent.detail, ...prev];
        });
        setLikesCountMap(prev => ({ ...prev, [customEvent.detail.id]: customEvent.detail.likes || 0 }));
        setSavesCountMap(prev => ({ ...prev, [customEvent.detail.id]: customEvent.detail.saves || 0 }));
      }
    };

    const handlePostDeleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      if (customEvent.detail?.id) {
        setPosts(prev => prev.filter(p => p.id !== customEvent.detail.id));
      }
    };

    window.addEventListener('nexora:post-created', handlePostCreated);
    window.addEventListener('nexora:post-deleted', handlePostDeleted);
    return () => {
      window.removeEventListener('nexora:post-created', handlePostCreated);
      window.removeEventListener('nexora:post-deleted', handlePostDeleted);
    };
  }, []);

  const toggleLike = async (postId: string): Promise<{ success: boolean; requiresAuth?: boolean; message?: string }> => {
    // Concurrency defense
    if (actionInProgress[`like:${postId}`]) {
      return { success: false, message: 'الطلب قيد المعالجة' };
    }

    const currentLiked = !!likedMap[postId];
    const prevCount = likesCountMap[postId] ?? (posts.find(p => p.id === postId)?.likes || 0);

    // Concurrency lock
    setActionInProgress(prev => ({ ...prev, [`like:${postId}`]: true }));

    try {
      const result = await communityService.toggleLike(postId, currentLiked);

      // Update state upon confirmed server response
      setLikedMap(prev => ({ ...prev, [postId]: result.liked }));
      setLikesCountMap(prev => ({ ...prev, [postId]: result.likesCount }));

      return { success: true };
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        return { success: false, requiresAuth: true, message: 'يرجى تسجيل الدخول لتسجيل الإعجاب بالمشاركة' };
      }
      const msg = err instanceof ApiError ? err.message : 'تعذر تسجيل الإعجاب';
      return { success: false, message: msg };
    } finally {
      setActionInProgress(prev => ({ ...prev, [`like:${postId}`]: false }));
    }
  };

  const toggleSave = async (postId: string): Promise<{ success: boolean; requiresAuth?: boolean; message?: string }> => {
    // Concurrency defense
    if (actionInProgress[`save:${postId}`]) {
      return { success: false, message: 'الطلب قيد المعالجة' };
    }

    const currentSaved = !!savedMap[postId];

    // Concurrency lock
    setActionInProgress(prev => ({ ...prev, [`save:${postId}`]: true }));

    try {
      const result = await communityService.toggleBookmark(postId, currentSaved);

      // Update state upon confirmed server response
      setSavedMap(prev => ({ ...prev, [postId]: result.bookmarked }));
      setSavesCountMap(prev => ({ ...prev, [postId]: result.bookmarksCount }));

      return { success: true };
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        return { success: false, requiresAuth: true, message: 'يرجى تسجيل الدخول لحفظ المشاركة في المفضلة' };
      }
      const msg = err instanceof ApiError ? err.message : 'تعذر حفظ المشاركة';
      return { success: false, message: msg };
    } finally {
      setActionInProgress(prev => ({ ...prev, [`save:${postId}`]: false }));
    }
  };

  return {
    posts,
    pagination,
    isLoading,
    error,
    likedMap,
    savedMap,
    likesCountMap,
    savesCountMap,
    actionInProgress,
    loadPosts,
    toggleLike,
    toggleSave,
  };
}
