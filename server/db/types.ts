export interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  name: string;
  code: string;
  module: string;
  description: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role_id: string;
  is_active: boolean;
  email_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  school_or_org: string | null;
  district: string | null;
  bio: string | null;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SanitizedUser {
  id: string;
  email: string;
  role_id: string;
  role_code: string;
  role_name: string;
  full_name: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Pagination & Query Interfaces
// ----------------------------------------------------------------------------
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ----------------------------------------------------------------------------
// Community Domain Types
// ----------------------------------------------------------------------------
export type PostStatus = 'draft' | 'review' | 'published' | 'hidden' | 'archived';

export interface CommunityPost {
  id: string;
  author_id: string;
  author_name?: string;
  author_role?: string;
  title: string;
  subject: string;
  grade_level: string;
  summary: string;
  content: string | null;
  status: PostStatus;
  likes_count: number;
  comments_count: number;
  bookmarks_count: number;
  views_count: number;
  is_pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  is_liked_by_me?: boolean;
  is_bookmarked_by_me?: boolean;
}

export interface CommunityAttachment {
  id: string;
  post_id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  mime_type: string;
  file_type: string;
  created_at: string;
}

export type CommentStatus = 'published' | 'hidden' | 'flagged';

export interface CommunityComment {
  id: string;
  post_id: string;
  author_id: string;
  author_name?: string;
  content: string;
  status: CommentStatus;
  parent_comment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityLike {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface CommunityBookmark {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface PostFilterParams extends PaginationParams {
  subject?: string;
  grade_level?: string;
  author_id?: string;
  status?: PostStatus;
  search?: string;
  tag?: string;
  pinned_first?: boolean;
}

// ----------------------------------------------------------------------------
// Library Domain Types
// ----------------------------------------------------------------------------
export type ResourceCategory = 'books' | 'guides' | 'worksheets' | 'exams' | 'curriculum' | 'research';
export type ResourceStatus = 'draft' | 'review' | 'published' | 'archived';

export interface LibraryResource {
  id: string;
  title: string;
  description: string | null;
  category: ResourceCategory;
  subject: string;
  grade_level: string;
  author_id: string | null;
  publisher_name: string | null;
  file_url: string;
  file_size_bytes: number;
  file_type: string;
  mime_type: string;
  status: ResourceStatus;
  downloads_count: number;
  views_count: number;
  created_at: string;
  updated_at: string;
}

export interface ResourceFilterParams extends PaginationParams {
  category?: ResourceCategory;
  subject?: string;
  grade_level?: string;
  status?: ResourceStatus;
  search?: string;
}

// ----------------------------------------------------------------------------
// Content & Event Domain Types
// ----------------------------------------------------------------------------
export type ContentCategory = 'article' | 'video' | 'news' | 'event' | 'announcement';
export type ContentStatus = 'draft' | 'published' | 'archived';

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  category: ContentCategory;
  subject: string | null;
  grade_level: string | null;
  author_id: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  read_time_minutes: number;
  status: ContentStatus;
  featured: boolean;
  views_count: number;
  created_at: string;
  updated_at: string;
  event_detail?: EventDetail;
}

export type LocationType = 'virtual' | 'in_person' | 'hybrid';

export interface EventDetail {
  id: string;
  content_item_id: string;
  event_date: string;
  duration_minutes: number;
  location_type: LocationType;
  location_address: string | null;
  speaker_name: string;
  speaker_title: string | null;
  seats_capacity: number;
  seats_booked: number;
  created_at: string;
  updated_at: string;
  is_registered_by_me?: boolean;
}

export type RegistrationStatus = 'confirmed' | 'waitlisted' | 'cancelled' | 'attended';

export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  status: RegistrationStatus;
  registration_notes: string | null;
  created_at: string;
}

export interface ContentFilterParams extends PaginationParams {
  category?: ContentCategory;
  subject?: string;
  grade_level?: string;
  status?: ContentStatus;
  featured?: boolean;
  search?: string;
}

// ----------------------------------------------------------------------------
// Contact Inquiries Domain Types
// ----------------------------------------------------------------------------
export type InquiryStatus = 'received' | 'in_progress' | 'resolved' | 'closed';

export interface ContactInquiry {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  portal_code: string | null;
  status: InquiryStatus;
  admin_notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactFilterParams extends PaginationParams {
  status?: InquiryStatus;
  portal_code?: string;
  search?: string;
}

