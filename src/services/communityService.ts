/**
 * NEXORA Community Service
 * Connects frontend Community section to the approved /api/v1/community REST routes.
 * Phase 5 / P1.4.3 Architecture.
 */

import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from './apiClient';
import {
  adaptCommunityPostFromBackend,
  adaptCommunityPostsList,
  adaptCreatePostPayload,
  adaptCommentFromBackend,
} from './adapters/communityAdapter';
import {
  BackendCommunityPostDTO,
  BackendCommentDTO,
  ApiPaginationMeta,
  AdaptedComment,
} from '../types/contracts';
import { CommunityPost } from '../types';

export interface FetchPostsParams {
  page?: number;
  limit?: number;
  subject?: string;
  grade_level?: string;
  search?: string;
  tag?: string;
}

export interface FetchPostsResult {
  posts: CommunityPost[];
  pagination: ApiPaginationMeta;
}

export const communityService = {
  /**
   * Fetches published community posts with optional filtering and pagination
   */
  async getPosts(params: FetchPostsParams = {}): Promise<FetchPostsResult> {
    const res = await apiGet<{
      success: boolean;
      data: BackendCommunityPostDTO[];
      pagination: ApiPaginationMeta;
    }>('/community/posts', {
      params: {
        page: params.page,
        limit: params.limit,
        subject: params.subject,
        grade_level: params.grade_level,
        search: params.search,
        tag: params.tag,
      },
    });

    return {
      posts: adaptCommunityPostsList(res.data),
      pagination: res.pagination,
    };
  },

  /**
   * Fetches a single post by ID from server
   */
  async getPostById(id: string): Promise<CommunityPost> {
    const res = await apiGet<{
      success: boolean;
      post: BackendCommunityPostDTO;
    }>(`/community/posts/${encodeURIComponent(id)}`);

    return adaptCommunityPostFromBackend(res.post);
  },

  /**
   * Creates a new community post via POST /api/v1/community/posts
   */
  async createPost(input: {
    title: string;
    content: string;
    subject: string;
    grade: string;
    summary?: string;
    tags?: string[];
  }): Promise<CommunityPost> {
    const payload = adaptCreatePostPayload(input);
    const res = await apiPost<{
      success: boolean;
      message: string;
      post: BackendCommunityPostDTO;
    }>('/community/posts', payload);

    return adaptCommunityPostFromBackend(res.post);
  },

  /**
   * Updates an existing community post
   */
  async updatePost(
    id: string,
    updates: Partial<{
      title: string;
      content: string;
      subject: string;
      grade: string;
      summary?: string;
      tags?: string[];
    }>
  ): Promise<CommunityPost> {
    const body: Record<string, unknown> = {};
    if (updates.title !== undefined) body.title = updates.title;
    if (updates.content !== undefined) body.content = updates.content;
    if (updates.subject !== undefined) body.subject = updates.subject;
    if (updates.grade !== undefined) body.grade_level = updates.grade;
    if (updates.summary !== undefined) body.summary = updates.summary;
    if (updates.tags !== undefined) body.tags = updates.tags;

    const res = await apiPatch<{
      success: boolean;
      message: string;
      post: BackendCommunityPostDTO;
    }>(`/community/posts/${encodeURIComponent(id)}`, body);

    return adaptCommunityPostFromBackend(res.post);
  },

  /**
   * Archives/deletes a community post
   */
  async deletePost(id: string): Promise<void> {
    await apiDelete<{ success: boolean; message: string }>(
      `/community/posts/${encodeURIComponent(id)}`
    );
  },

  /**
   * Fetches comments for a specific post
   */
  async getComments(postId: string): Promise<AdaptedComment[]> {
    const res = await apiGet<{
      success: boolean;
      totalComments: number;
      comments: BackendCommentDTO[];
    }>(`/community/posts/${encodeURIComponent(postId)}/comments`);

    return Array.isArray(res.comments) ? res.comments.map(adaptCommentFromBackend) : [];
  },

  /**
   * Adds a new comment to a post
   */
  async addComment(postId: string, content: string): Promise<AdaptedComment> {
    const res = await apiPost<{
      success: boolean;
      message: string;
      comment: BackendCommentDTO;
    }>(`/community/posts/${encodeURIComponent(postId)}/comments`, { content });

    return adaptCommentFromBackend(res.comment);
  },

  /**
   * Toggles like state for a post idempotently
   */
  async toggleLike(postId: string, isCurrentlyLiked: boolean): Promise<{ liked: boolean; likesCount: number }> {
    if (isCurrentlyLiked) {
      const res = await apiDelete<{ success: boolean; liked: boolean; likesCount: number }>(
        `/community/posts/${encodeURIComponent(postId)}/likes`
      );
      return { liked: Boolean(res.liked), likesCount: Number(res.likesCount) || 0 };
    } else {
      const res = await apiPost<{ success: boolean; liked: boolean; likesCount: number }>(
        `/community/posts/${encodeURIComponent(postId)}/likes`,
        {}
      );
      return { liked: Boolean(res.liked), likesCount: Number(res.likesCount) || 0 };
    }
  },

  /**
   * Toggles bookmark/save state for a post idempotently
   */
  async toggleBookmark(postId: string, isCurrentlySaved: boolean): Promise<{ bookmarked: boolean; bookmarksCount: number }> {
    if (isCurrentlySaved) {
      const res = await apiDelete<{ success: boolean; bookmarked: boolean; bookmarksCount: number }>(
        `/community/posts/${encodeURIComponent(postId)}/bookmarks`
      );
      return { bookmarked: Boolean(res.bookmarked), bookmarksCount: Number(res.bookmarksCount) || 0 };
    } else {
      const res = await apiPost<{ success: boolean; bookmarked: boolean; bookmarksCount: number }>(
        `/community/posts/${encodeURIComponent(postId)}/bookmarks`,
        {}
      );
      return { bookmarked: Boolean(res.bookmarked), bookmarksCount: Number(res.bookmarksCount) || 0 };
    }
  },
};

export { ApiError };
