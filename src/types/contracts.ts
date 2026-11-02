/**
 * NEXORA API & Frontend Contracts
 * Complete TypeScript definitions decoupling Backend Raw DTOs from Frontend View Models.
 * Phase 5 / P1.4.2 Architectural Contracts.
 */

import { CommunityPost, ContentItem } from './index';

// ============================================================================
// 1. GENERIC API TRANSPORT & ENVELOPE CONTRACTS
// ============================================================================

export interface ApiPaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ApiPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: ApiPaginationMeta;
  message?: string;
}

export interface ApiSingleResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiActionResponse {
  success: boolean;
  message: string;
  [key: string]: unknown;
}

export interface ApiErrorPayload {
  success: false;
  error: string;
  message: string;
  details?: unknown;
  requestId?: string;
  statusCode?: number;
}

// ============================================================================
// 2. BACKEND RAW DTOs (Direct from Database & Routes)
// ============================================================================

export interface BackendCommunityPostDTO {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  title: string;
  subject: string;
  grade_level: string;
  summary: string;
  content: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  likes_count: number;
  comments_count: number;
  bookmarks_count: number;
  views_count: number;
  is_pinned?: boolean;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface BackendCommentDTO {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface BackendLibraryResourceDTO {
  id: string;
  title: string;
  description: string;
  category: 'books' | 'worksheets' | 'guides' | 'research' | 'curriculum';
  subject: string;
  grade_level: string;
  author_id: string;
  publisher_name: string;
  file_url: string;
  file_size_bytes: number;
  file_type: string;
  mime_type: string;
  status: 'draft' | 'published' | 'archived';
  downloads_count: number;
  views_count: number;
  created_at: string;
  updated_at: string;
}

export interface BackendEventDetailDTO {
  id: string;
  content_item_id: string;
  event_date: string;
  duration_minutes: number;
  location_type: 'virtual' | 'in_person' | 'hybrid';
  location_address?: string | null;
  speaker_name: string;
  speaker_title: string;
  seats_capacity: number;
  seats_booked: number;
  created_at: string;
  updated_at: string;
  is_registered_by_me?: boolean;
}

export interface BackendContentItemDTO {
  id: string;
  title: string;
  description: string;
  category: 'article' | 'video' | 'news' | 'event' | 'announcement';
  subject?: string | null;
  grade_level?: string | null;
  author_id: string;
  author_name?: string;
  thumbnail_url?: string | null;
  video_url?: string | null;
  read_time_minutes?: number | null;
  status: 'draft' | 'review' | 'published' | 'archived';
  featured?: boolean;
  views_count: number;
  created_at: string;
  updated_at: string;
  event_detail?: BackendEventDetailDTO | null;
}

export interface BackendContactInquiryDTO {
  id: string;
  user_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  portal_code?: string | null;
  status: 'received' | 'in_progress' | 'resolved' | 'closed';
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 3. FRONTEND VIEW MODELS & SUBMISSION PAYLOADS
// ============================================================================

export interface LibraryResourceViewModel {
  id: string;
  title: string;
  description: string;
  category: string;
  subject: string;
  grade: string;
  publisher: string;
  downloadUrl: string;
  fileSizeFormatted: string;
  fileType: string;
  mimeType: string;
  downloadsCount: number;
  viewsCount: number;
  publishedDate: string;
}

export interface EventDetailViewModel {
  id: string;
  eventDate: string;
  eventTime: string;
  durationFormatted: string;
  locationTypeFormatted: 'حضوري' | 'عن بُعد عبر Teams' | 'هجين';
  locationAddress: string;
  speakerName: string;
  speakerTitle: string;
  seatsCapacity: number;
  seatsBooked: number;
  seatsLeft: number;
  isFullyBooked: boolean;
  isRegisteredByMe: boolean;
}

export interface UnifiedContentViewModel extends ContentItem {
  rawCategory: string;
  isEvent: boolean;
  eventInfo?: EventDetailViewModel;
  isFeatured: boolean;
  status: string;
}

export interface CreatePostPayload {
  title: string;
  subject: string;
  grade_level: string;
  summary: string;
  content: string;
  tags?: string[];
  status?: 'draft' | 'review' | 'published';
}

export interface CreateInquiryPayload {
  full_name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  portal_code?: string | null;
}

export interface RegisterEventResult {
  success: boolean;
  message: string;
  registrationId?: string;
  eventContentId?: string;
  registeredAt?: string;
}

export interface DownloadResourceResult {
  success: boolean;
  resourceId: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  downloadsCount: number;
}

export interface AdaptedComment {
  id: string;
  postId: string;
  author: {
    id: string;
    name: string;
    role: string;
    avatar?: string;
  };
  content: string;
  createdAt: string;
}

// ============================================================================
// 4. SUPPORT & INQUIRY CONTRACTS
// ============================================================================

export type BackendInquiryStatus = 'received' | 'in_progress' | 'resolved' | 'closed';

export type SupportInquiryPayload = CreateInquiryPayload;

export interface BackendSupportInquiry {
  id: string;
  user_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  portal_code?: string | null;
  status: BackendInquiryStatus;
  admin_notes?: string | null;
  assigned_to?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface SupportInquiryUI {
  id: string;
  userId?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  portalCode?: string | null;
  status: BackendInquiryStatus;
  statusArabic: string;
  statusColor: string;
  adminNotes?: string | null;
  assignedTo?: string | null;
  createdAt: string;
  date: string;
}

export interface InquiryFilters {
  page?: number;
  limit?: number;
  status?: string;
  portal_code?: string;
  search?: string;
}

export interface EventPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore?: boolean;
}

export interface InquiriesApiResponse {
  success: boolean;
  data?: BackendSupportInquiry[];
  pagination?: EventPagination;
  error?: string;
  message?: string;
}

export interface SingleInquiryApiResponse {
  success: boolean;
  inquiry?: BackendSupportInquiry;
  data?: BackendSupportInquiry;
  error?: string;
  message?: string;
}

export interface CreateInquiryApiResponse {
  success: boolean;
  inquiry?: {
    id: string;
    subject: string;
    status: string;
    created_at: string;
    [key: string]: any;
  };
  data?: BackendSupportInquiry;
  error?: string;
  message?: string;
}

export interface UpdateInquiryStatusPayload {
  status: BackendInquiryStatus;
  admin_notes?: string;
  assigned_to?: string;
}

// ============================================================================
// 5. TEACHER WORKSPACE CONTRACTS (PHASE 2.2)
// ============================================================================

export interface TeacherClassModel {
  id: string;
  teacher_id: string;
  name: string;
  subject: string;
  grade_level: string;
  academic_year: string;
  term: 'term_1' | 'term_2' | 'summer';
  join_code: string;
  room_number?: string | null;
  status: 'active' | 'archived' | 'completed';
  student_count?: number;
  attendance_rate?: number;
  created_at: string;
  updated_at: string;
}

export interface ClassStudentModel {
  id: string;
  class_id: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  status: 'active' | 'dropped' | 'transferred' | 'suspended';
  joined_at: string;
  updated_at: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecordModel {
  id: string;
  class_id: string;
  student_id: string;
  student_name?: string;
  attendance_date: string;
  session_number: number;
  status: AttendanceStatus;
  notes?: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceSummaryModel {
  total_sessions: number;
  total_records: number;
  attendance_rate: number;
  student_breakdown: Array<{
    student_id: string;
    student_name?: string;
    present_count: number;
    absent_count: number;
    late_count: number;
    excused_count: number;
    rate: number;
  }>;
}

export interface CreateClassPayload {
  name: string;
  grade_level: string;
  academic_year: string;
  term: 'term_1' | 'term_2' | 'summer';
  subject?: string;
  room_number?: string;
}

export interface UpdateClassPayload {
  name?: string;
  grade_level?: string;
  academic_year?: string;
  term?: 'term_1' | 'term_2' | 'summer';
  subject?: string;
  room_number?: string | null;
  status?: 'active' | 'archived' | 'completed';
}

export interface BatchAttendancePayload {
  records: Array<{
    student_id: string;
    attendance_date: string;
    session_number: number;
    status: AttendanceStatus;
    notes?: string;
  }>;
}

export interface CsvImportValidationResult {
  valid: Array<{ student_id: string; student_name: string; student_email?: string }>;
  errors: Array<{ row_index: number; record: any; reason: string }>;
  summary: {
    total: number;
    valid_count: number;
    error_count: number;
    duplicate_count: number;
  };
}



