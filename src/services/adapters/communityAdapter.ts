/**
 * Community Data Adapter
 * Converts between Backend DTOs and Frontend View Models for Community Posts and Comments.
 * Phase 5 / P1.4.2 Architecture.
 */

import { CommunityPost } from '../../types';
import {
  BackendCommunityPostDTO,
  BackendCommentDTO,
  CreatePostPayload,
  AdaptedComment,
} from '../../types/contracts';

/**
 * Formats an ISO date string into a friendly Arabic date or relative time string.
 */
export function formatArabicDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'مؤخراً';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'الآن';
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays === 1) return 'أمس';
    if (diffDays === 2) return 'منذ يومين';
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`;

    // Localized Arabic calendar format
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Transforms a single backend community post DTO into the frontend CommunityPost model.
 * Strict Rule: Never fabricate specific schools or districts if absent from backend.
 */
export function adaptCommunityPostFromBackend(dto: BackendCommunityPostDTO): CommunityPost {
  const summary = dto.summary || (dto.content
    ? (dto.content.length > 150 ? `${dto.content.substring(0, 150)}...` : dto.content)
    : dto.title);

  return {
    id: dto.id,
    title: dto.title || '',
    summary,
    content: dto.content || '',
    author: {
      name: dto.author_name || 'معلم تربوي',
      role: dto.author_role || 'معلم معتمد',
      // Clean fallback: do NOT fabricate arbitrary specific school names
      school: 'مدرسة معتمدة',
      district: 'المملكة العربية السعودية',
    },
    // Safe fallback cast for subject
    subject: (dto.subject || 'علوم عامة') as CommunityPost['subject'],
    grade: dto.grade_level || 'المرحلة الثانوية',
    publishedDate: formatArabicDate(dto.created_at),
    likes: Number(dto.likes_count) || 0,
    saves: Number(dto.bookmarks_count) || 0,
    fileType: dto.tags && dto.tags.length > 0 ? dto.tags[0] : undefined,
    attachmentsCount: 0,
    isLiked: Boolean((dto as any).is_liked),
    isSaved: Boolean((dto as any).is_saved),
    authorId: dto.author_id,
    commentsCount: Number(dto.comments_count) || 0,
  };
}

/**
 * Transforms an array of backend community post DTOs.
 */
export function adaptCommunityPostsList(dtos: BackendCommunityPostDTO[]): CommunityPost[] {
  if (!Array.isArray(dtos)) return [];
  return dtos.map(adaptCommunityPostFromBackend);
}

/**
 * Adapts user frontend form inputs to the backend CreatePostPayload contract.
 * Maps frontend 'grade' to backend 'grade_level', computes summary if omitted.
 */
export function adaptCreatePostPayload(input: {
  title: string;
  content: string;
  subject: string;
  grade?: string;
  grade_level?: string;
  summary?: string;
  tags?: string[];
  status?: 'draft' | 'review' | 'published';
}): CreatePostPayload {
  const trimmedContent = input.content?.trim() || '';
  const calculatedSummary = input.summary?.trim() || (trimmedContent.length > 150
    ? `${trimmedContent.substring(0, 150)}...`
    : trimmedContent);

  return {
    title: input.title?.trim() || '',
    summary: calculatedSummary,
    content: trimmedContent,
    subject: input.subject || 'علوم عامة',
    grade_level: input.grade_level || input.grade || 'المرحلة الثانوية',
    tags: Array.isArray(input.tags) ? input.tags.map(t => t.trim()).filter(Boolean) : [],
    status: input.status || 'published',
  };
}

/**
 * Transforms backend comment DTO to frontend adapted comment model.
 */
export function adaptCommentFromBackend(dto: BackendCommentDTO): AdaptedComment {
  return {
    id: dto.id,
    postId: dto.post_id,
    author: {
      id: dto.author_id,
      name: dto.author_name || 'عضو نكسورا',
      role: dto.author_role || 'معلم',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=faces',
    },
    content: dto.content,
    createdAt: formatArabicDate(dto.created_at),
  };
}
