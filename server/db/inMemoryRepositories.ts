import crypto from 'crypto';
import {
  CommunityPost,
  CommunityAttachment,
  CommunityComment,
  PostFilterParams,
  PaginatedResult,
  LibraryResource,
  ResourceFilterParams,
  ContentItem,
  EventDetail,
  EventRegistration,
  ContentFilterParams,
  ContactInquiry,
  ContactFilterParams,
  InquiryStatus,
  PaginationParams,
} from './types';

/**
 * In-Memory Resilient Repository Implementations
 * Used for offline development and testing when DATABASE_URL is not configured.
 * Seeded with standard mock-aligned data mirroring the Phase 5 schema design.
 */

// ============================================================================
// 1. Community In-Memory Repository
// ============================================================================
export class InMemoryCommunityRepository {
  private posts: Map<string, CommunityPost> = new Map();
  private attachments: Map<string, CommunityAttachment> = new Map();
  private comments: Map<string, CommunityComment> = new Map();
  private likes: Set<string> = new Set(); // format: `${postId}:${userId}`
  private bookmarks: Set<string> = new Set(); // format: `${postId}:${userId}`

  constructor() {
    this.seed();
  }

  private seed() {
    const now = new Date().toISOString();
    const initialPosts: CommunityPost[] = [
      {
        id: 'post_seed_001',
        author_id: 'usr_mock_teach_01',
        author_name: 'أحمد محمود عاشور',
        author_role: 'TEACH',
        title: 'خطة استراتيجية لتدريس منهج العلوم للصف الثامن عبر الاستقصاء',
        subject: 'علوم عامة',
        grade_level: 'الصف الثامن',
        summary: 'دليل عملي للمعلمين لتطبيق دورة التعلم الخماسية 5E في دروس الكيمياء والفيزياء.',
        content: 'تفاصيل الخطة التدريسية ونماذج التقويم البنائي والمختبرات الافتراضية الداعمة...',
        status: 'published',
        likes_count: 5,
        comments_count: 2,
        bookmarks_count: 3,
        views_count: 42,
        is_pinned: true,
        tags: ['استقصاء', 'الصف الثامن', 'كيمياء', 'تجارب'],
        created_at: now,
        updated_at: now,
      },
      {
        id: 'post_seed_002',
        author_id: 'usr_mock_lead_01',
        author_name: 'د. خالد العمري',
        author_role: 'LEAD',
        title: 'معايير إعداد بنوك الأسئلة وفق جدول المواصفات الفنية الحديث',
        subject: 'إشراف تربوي',
        grade_level: 'المرحلة المتوسطة',
        summary: 'إرشادات التوجيه الفني لإعداد الاختبارات المعيارية وقياس مهارات التفكير العليا.',
        content: 'يتناول هذا المنشور ضوابط الصياغة والتحليل الإحصائي لفقرات الاختبار...',
        status: 'published',
        likes_count: 12,
        comments_count: 4,
        bookmarks_count: 8,
        views_count: 89,
        is_pinned: false,
        tags: ['بنوك_أسئلة', 'تقويم', 'إشراف'],
        created_at: now,
        updated_at: now,
      },
    ];

    for (const p of initialPosts) {
      this.posts.set(p.id, p);
    }

    const initialComments: CommunityComment[] = [
      {
        id: 'comment_seed_001',
        post_id: 'post_seed_001',
        author_id: 'usr_mock_teach_02',
        author_name: 'سارة عبد الله',
        content: 'خطة ممتازة ومثمرة جداً، شكراً للأستاذ أحمد على المشاركة القيمة.',
        status: 'published',
        parent_comment_id: null,
        created_at: now,
        updated_at: now,
      },
    ];

    for (const c of initialComments) {
      this.comments.set(c.id, c);
    }
  }

  public async listPosts(
    filters: PostFilterParams = {},
    currentUserId?: string
  ): Promise<PaginatedResult<CommunityPost>> {
    let all = Array.from(this.posts.values());

    const targetStatus = filters.status || 'published';
    all = all.filter((p) => p.status === targetStatus);

    if (filters.subject) {
      all = all.filter((p) => p.subject === filters.subject);
    }
    if (filters.grade_level) {
      all = all.filter((p) => p.grade_level === filters.grade_level);
    }
    if (filters.author_id) {
      all = all.filter((p) => p.author_id === filters.author_id);
    }
    if (filters.tag) {
      all = all.filter((p) => p.tags.includes(filters.tag!));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      all = all.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.summary.toLowerCase().includes(q) ||
          (p.content && p.content.toLowerCase().includes(q))
      );
    }

    // Sort by pinned first, then created_at desc
    all.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const total = all.length;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 10));
    const offset = filters.offset ?? (page - 1) * limit;

    const sliced = all.slice(offset, offset + limit).map((p) => {
      const copy = { ...p };
      if (currentUserId) {
        copy.is_liked_by_me = this.likes.has(`${p.id}:${currentUserId}`);
        copy.is_bookmarked_by_me = this.bookmarks.has(`${p.id}:${currentUserId}`);
      }
      return copy;
    });

    return {
      data: sliced,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    };
  }

  public async getPostById(id: string, currentUserId?: string): Promise<CommunityPost | null> {
    const post = this.posts.get(id);
    if (!post) return null;

    post.views_count++;
    const res = { ...post };
    if (currentUserId) {
      res.is_liked_by_me = this.likes.has(`${id}:${currentUserId}`);
      res.is_bookmarked_by_me = this.bookmarks.has(`${id}:${currentUserId}`);
    }
    return res;
  }

  public async createPost(
    post: Omit<CommunityPost, 'created_at' | 'updated_at' | 'likes_count' | 'comments_count' | 'bookmarks_count' | 'views_count'>,
    attachments?: Omit<CommunityAttachment, 'id' | 'post_id' | 'created_at'>[]
  ): Promise<CommunityPost> {
    const id = post.id || `post_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const created: CommunityPost = {
      id,
      author_id: post.author_id,
      author_name: post.author_name || 'معلم العلوم',
      author_role: post.author_role || 'TEACH',
      title: post.title.trim(),
      subject: post.subject.trim(),
      grade_level: post.grade_level.trim(),
      summary: post.summary.trim(),
      content: post.content || null,
      status: post.status || 'published',
      likes_count: 0,
      comments_count: 0,
      bookmarks_count: 0,
      views_count: 0,
      is_pinned: post.is_pinned || false,
      tags: post.tags || [],
      created_at: now,
      updated_at: now,
    };

    this.posts.set(id, created);

    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        const attId = `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        this.attachments.set(attId, {
          id: attId,
          post_id: id,
          file_name: att.file_name,
          file_path: att.file_path,
          file_size_bytes: att.file_size_bytes,
          mime_type: att.mime_type,
          file_type: att.file_type,
          created_at: now,
        });
      }
    }

    return created;
  }

  public async updatePost(
    id: string,
    authorId: string,
    updates: Partial<Pick<CommunityPost, 'title' | 'subject' | 'grade_level' | 'summary' | 'content' | 'status' | 'tags'>>
  ): Promise<CommunityPost> {
    const post = this.posts.get(id);
    if (!post || post.author_id !== authorId) {
      throw new Error('UNAUTHORIZED_OR_NOT_FOUND: ليس لديك صلاحية تعديل هذا المنشور أو أنه غير موجود');
    }

    if (updates.title !== undefined) post.title = updates.title.trim();
    if (updates.subject !== undefined) post.subject = updates.subject.trim();
    if (updates.grade_level !== undefined) post.grade_level = updates.grade_level.trim();
    if (updates.summary !== undefined) post.summary = updates.summary.trim();
    if (updates.content !== undefined) post.content = updates.content;
    if (updates.status !== undefined) post.status = updates.status;
    if (updates.tags !== undefined) post.tags = updates.tags;
    post.updated_at = new Date().toISOString();

    return { ...post };
  }

  public async softDeletePost(id: string, authorId: string, isAdmin = false): Promise<boolean> {
    const post = this.posts.get(id);
    if (!post) return false;
    if (!isAdmin && post.author_id !== authorId) return false;

    post.status = 'archived';
    post.updated_at = new Date().toISOString();
    return true;
  }

  public async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
    const post = this.posts.get(postId);
    if (!post) throw new Error('POST_NOT_FOUND: المنشور غير موجود');

    const key = `${postId}:${userId}`;
    let liked = false;
    if (this.likes.has(key)) {
      this.likes.delete(key);
      post.likes_count = Math.max(0, post.likes_count - 1);
      liked = false;
    } else {
      this.likes.add(key);
      post.likes_count++;
      liked = true;
    }

    return { liked, likesCount: post.likes_count };
  }

  public async toggleBookmark(postId: string, userId: string): Promise<{ bookmarked: boolean; bookmarksCount: number }> {
    const post = this.posts.get(postId);
    if (!post) throw new Error('POST_NOT_FOUND: المنشور غير موجود');

    const key = `${postId}:${userId}`;
    let bookmarked = false;
    if (this.bookmarks.has(key)) {
      this.bookmarks.delete(key);
      post.bookmarks_count = Math.max(0, post.bookmarks_count - 1);
      bookmarked = false;
    } else {
      this.bookmarks.add(key);
      post.bookmarks_count++;
      bookmarked = true;
    }

    return { bookmarked, bookmarksCount: post.bookmarks_count };
  }

  public async addComment(
    postId: string,
    authorId: string,
    content: string,
    parentCommentId?: string
  ): Promise<CommunityComment> {
    const post = this.posts.get(postId);
    if (!post) throw new Error('POST_NOT_FOUND: المنشور غير موجود');

    const trimmed = content.trim();
    if (!trimmed) throw new Error('COMMENT_EMPTY: محتوى التعليق لا يمكن أن يكون فارغاً');

    const id = `comment_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const comment: CommunityComment = {
      id,
      post_id: postId,
      author_id: authorId,
      author_name: 'معلم العلوم',
      content: trimmed,
      status: 'published',
      parent_comment_id: parentCommentId || null,
      created_at: now,
      updated_at: now,
    };

    this.comments.set(id, comment);
    post.comments_count++;
    return comment;
  }

  public async listComments(postId: string): Promise<CommunityComment[]> {
    return Array.from(this.comments.values())
      .filter((c) => c.post_id === postId && c.status === 'published')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  public async listBookmarks(userId: string, params: PaginationParams = {}): Promise<PaginatedResult<CommunityPost>> {
    const bookmarkedPostIds = Array.from(this.bookmarks)
      .filter((k) => k.endsWith(`:${userId}`))
      .map((k) => k.split(':')[0]);

    const matchingPosts = bookmarkedPostIds
      .map((id) => this.posts.get(id))
      .filter((p): p is CommunityPost => Boolean(p && p.status === 'published'))
      .map((p) => ({
        ...p,
        is_bookmarked_by_me: true,
        is_liked_by_me: this.likes.has(`${p.id}:${userId}`),
      }));

    const total = matchingPosts.length;
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 10));
    const offset = params.offset ?? (page - 1) * limit;

    return {
      data: matchingPosts.slice(offset, offset + limit),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    };
  }
}

// ============================================================================
// 2. Library In-Memory Repository
// ============================================================================
export class InMemoryLibraryRepository {
  private resources: Map<string, LibraryResource> = new Map();

  constructor() {
    this.seed();
  }

  private seed() {
    const now = new Date().toISOString();
    const initial: LibraryResource[] = [
      {
        id: 'res_seed_001',
        title: 'دليل التجارب العلمية العملية للمرحلة المتوسطة',
        description: 'دليل شامل يتضمن 30 تجربة مختبرية وتفاعلية في الفيزياء والكيمياء والأحياء.',
        category: 'guides',
        subject: 'علوم عامة',
        grade_level: 'المرحلة المتوسطة',
        author_id: 'usr_mock_lead_01',
        publisher_name: 'أكاديمية عاشور التربوية',
        file_url: 'https://cdn.ashouracademy.com/library/science_lab_guide_2026.pdf',
        file_size_bytes: 4850000,
        file_type: 'pdf',
        mime_type: 'application/pdf',
        status: 'published',
        downloads_count: 128,
        views_count: 310,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'res_seed_002',
        title: 'أوراق عمل التفكير العلمي وحل المشكلات — الصف التاسع',
        description: 'مجموعة متكاملة من أوراق العمل والأنشطة التمايزية لتعزيز التفكير الناقد.',
        category: 'worksheets',
        subject: 'كيمياء وفيزياء',
        grade_level: 'الصف التاسع',
        author_id: 'usr_mock_teach_01',
        publisher_name: 'قسم العلوم الطبيعية',
        file_url: 'https://cdn.ashouracademy.com/library/grade9_critical_thinking_sheets.pdf',
        file_size_bytes: 2150000,
        file_type: 'pdf',
        mime_type: 'application/pdf',
        status: 'published',
        downloads_count: 64,
        views_count: 145,
        created_at: now,
        updated_at: now,
      },
    ];

    for (const r of initial) {
      this.resources.set(r.id, r);
    }
  }

  public async listResources(filters: ResourceFilterParams = {}): Promise<PaginatedResult<LibraryResource>> {
    let all = Array.from(this.resources.values());

    const targetStatus = filters.status || 'published';
    all = all.filter((r) => r.status === targetStatus);

    if (filters.category) {
      all = all.filter((r) => r.category === filters.category);
    }
    if (filters.subject) {
      all = all.filter((r) => r.subject === filters.subject);
    }
    if (filters.grade_level) {
      all = all.filter((r) => r.grade_level === filters.grade_level);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      all = all.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (r.publisher_name && r.publisher_name.toLowerCase().includes(q))
      );
    }

    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = all.length;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 12));
    const offset = filters.offset ?? (page - 1) * limit;

    return {
      data: all.slice(offset, offset + limit),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    };
  }

  public async getResourceById(id: string): Promise<LibraryResource | null> {
    const res = this.resources.get(id);
    if (!res) return null;
    res.views_count++;
    return { ...res };
  }

  public async createResource(
    resource: Omit<LibraryResource, 'created_at' | 'updated_at' | 'downloads_count' | 'views_count'>
  ): Promise<LibraryResource> {
    const id = resource.id || `res_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const created: LibraryResource = {
      id,
      title: resource.title.trim(),
      description: resource.description || null,
      category: resource.category,
      subject: resource.subject.trim(),
      grade_level: resource.grade_level.trim(),
      author_id: resource.author_id || null,
      publisher_name: resource.publisher_name || null,
      file_url: resource.file_url,
      file_size_bytes: resource.file_size_bytes,
      file_type: resource.file_type,
      mime_type: resource.mime_type,
      status: resource.status || 'published',
      downloads_count: 0,
      views_count: 0,
      created_at: now,
      updated_at: now,
    };

    this.resources.set(id, created);
    return created;
  }

  public async updateResource(
    id: string,
    updates: Partial<Pick<LibraryResource, 'title' | 'description' | 'category' | 'subject' | 'grade_level' | 'status'>>
  ): Promise<LibraryResource> {
    const res = this.resources.get(id);
    if (!res) throw new Error('RESOURCE_NOT_FOUND: المورد غير موجود');

    if (updates.title !== undefined) res.title = updates.title.trim();
    if (updates.description !== undefined) res.description = updates.description;
    if (updates.category !== undefined) res.category = updates.category;
    if (updates.subject !== undefined) res.subject = updates.subject.trim();
    if (updates.grade_level !== undefined) res.grade_level = updates.grade_level.trim();
    if (updates.status !== undefined) res.status = updates.status;
    res.updated_at = new Date().toISOString();

    return { ...res };
  }

  public async softDeleteResource(id: string): Promise<boolean> {
    const res = this.resources.get(id);
    if (!res) return false;
    res.status = 'archived';
    res.updated_at = new Date().toISOString();
    return true;
  }

  public async incrementDownloads(id: string): Promise<number> {
    const res = this.resources.get(id);
    if (!res) throw new Error('RESOURCE_NOT_FOUND: المورد غير موجود');
    res.downloads_count++;
    res.updated_at = new Date().toISOString();
    return res.downloads_count;
  }
}

// ============================================================================
// 3. Content & Events In-Memory Repository
// ============================================================================
export class InMemoryContentRepository {
  private content: Map<string, ContentItem> = new Map();
  private eventDetails: Map<string, EventDetail> = new Map();
  private registrations: Map<string, EventRegistration> = new Map();

  constructor() {
    this.seed();
  }

  private seed() {
    const now = new Date().toISOString();
    const article: ContentItem = {
      id: 'cnt_seed_001',
      title: 'دمج الذكاء الاصطناعي التوليدي في تصميم الأنشطة العلمية التفاعلية',
      description: 'مقال تحليلي يستعرض أفضل الممارسات المعتمدة لتوظيف نماذج اللغة في إثراء حصص العلوم.',
      category: 'article',
      subject: 'تكنولوجيا التعليم',
      grade_level: 'جميع المراحل',
      author_id: 'usr_mock_lead_01',
      thumbnail_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',
      video_url: null,
      read_time_minutes: 6,
      status: 'published',
      featured: true,
      views_count: 512,
      created_at: now,
      updated_at: now,
    };
    this.content.set(article.id, article);

    const eventContent: ContentItem = {
      id: 'cnt_seed_event_001',
      title: 'المؤتمر الافتراضي السنوي لمعلمي العلوم والمبتكرين 2026',
      description: 'ملتقى أكاديمي تفاعلي يجمع نخبة من موجهي ومعلمي العلوم لاستعراض أحدث الأبحاث والتجارب الصفية.',
      category: 'event',
      subject: 'علوم متكاملة',
      grade_level: 'المرحلة الثانوية والمتوسطة',
      author_id: 'usr_mock_lead_01',
      thumbnail_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
      video_url: null,
      read_time_minutes: 10,
      status: 'published',
      featured: true,
      views_count: 850,
      created_at: now,
      updated_at: now,
    };

    const eventDetail: EventDetail = {
      id: 'evt_seed_001',
      content_item_id: eventContent.id,
      event_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      duration_minutes: 120,
      location_type: 'virtual',
      location_address: 'منصة NEXORA التفاعلية — القاعة الافتراضية الرئيسية',
      speaker_name: 'أ. د. أحمد عاشور',
      speaker_title: 'مستشار التطوير التربوي والتعليم الذكي',
      seats_capacity: 50,
      seats_booked: 2,
      created_at: now,
      updated_at: now,
    };

    eventContent.event_detail = eventDetail;
    this.content.set(eventContent.id, eventContent);
    this.eventDetails.set(eventDetail.id, eventDetail);
  }

  public async listContent(
    filters: ContentFilterParams = {},
    currentUserId?: string
  ): Promise<PaginatedResult<ContentItem>> {
    let all = Array.from(this.content.values());

    const targetStatus = filters.status || 'published';
    all = all.filter((c) => c.status === targetStatus);

    if (filters.category) {
      all = all.filter((c) => c.category === filters.category);
    }
    if (filters.subject) {
      all = all.filter((c) => c.subject === filters.subject);
    }
    if (filters.grade_level) {
      all = all.filter((c) => c.grade_level === filters.grade_level);
    }
    if (filters.featured !== undefined) {
      all = all.filter((c) => c.featured === filters.featured);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      all = all.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }

    all.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const total = all.length;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 10));
    const offset = filters.offset ?? (page - 1) * limit;

    const sliced = all.slice(offset, offset + limit).map((c) => {
      const copy = { ...c };
      if (copy.event_detail && currentUserId) {
        const isReg = Array.from(this.registrations.values()).some(
          (r) => r.event_id === copy.event_detail!.id && r.user_id === currentUserId
        );
        copy.event_detail = { ...copy.event_detail, is_registered_by_me: isReg };
      }
      return copy;
    });

    return {
      data: sliced,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    };
  }

  public async getContentById(id: string, currentUserId?: string): Promise<ContentItem | null> {
    const item = this.content.get(id);
    if (!item) return null;

    item.views_count++;
    const res = { ...item };
    if (res.event_detail && currentUserId) {
      const isReg = Array.from(this.registrations.values()).some(
        (r) => r.event_id === res.event_detail!.id && r.user_id === currentUserId
      );
      res.event_detail = { ...res.event_detail, is_registered_by_me: isReg };
    }
    return res;
  }

  public async createContentWithEvent(
    content: Omit<ContentItem, 'created_at' | 'updated_at' | 'views_count' | 'event_detail'>,
    eventDetail?: Omit<EventDetail, 'id' | 'content_item_id' | 'created_at' | 'updated_at' | 'seats_booked'>
  ): Promise<ContentItem> {
    const contentId = content.id || `cnt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const created: ContentItem = {
      id: contentId,
      title: content.title.trim(),
      description: content.description.trim(),
      category: content.category,
      subject: content.subject || null,
      grade_level: content.grade_level || null,
      author_id: content.author_id || null,
      thumbnail_url: content.thumbnail_url || null,
      video_url: content.video_url || null,
      read_time_minutes: content.read_time_minutes || 5,
      status: content.status || 'published',
      featured: content.featured || false,
      views_count: 0,
      created_at: now,
      updated_at: now,
    };

    if (eventDetail) {
      const eventId = `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const ed: EventDetail = {
        id: eventId,
        content_item_id: contentId,
        event_date: eventDetail.event_date,
        duration_minutes: eventDetail.duration_minutes || 60,
        location_type: eventDetail.location_type || 'virtual',
        location_address: eventDetail.location_address || null,
        speaker_name: eventDetail.speaker_name,
        speaker_title: eventDetail.speaker_title || null,
        seats_capacity: eventDetail.seats_capacity,
        seats_booked: 0,
        created_at: now,
        updated_at: now,
      };
      this.eventDetails.set(eventId, ed);
      created.event_detail = ed;
    }

    this.content.set(contentId, created);
    return created;
  }

  public async updateContent(
    id: string,
    updates: Partial<Pick<ContentItem, 'title' | 'description' | 'subject' | 'grade_level' | 'status' | 'featured' | 'thumbnail_url' | 'video_url' | 'read_time_minutes'>>
  ): Promise<ContentItem> {
    const item = this.content.get(id);
    if (!item) throw new Error('CONTENT_NOT_FOUND: المحتوى غير موجود');

    if (updates.title !== undefined) item.title = updates.title.trim();
    if (updates.description !== undefined) item.description = updates.description.trim();
    if (updates.subject !== undefined) item.subject = updates.subject ? updates.subject.trim() : null;
    if (updates.grade_level !== undefined) item.grade_level = updates.grade_level ? updates.grade_level.trim() : null;
    if (updates.status !== undefined) item.status = updates.status;
    if (updates.featured !== undefined) item.featured = updates.featured;
    if (updates.thumbnail_url !== undefined) item.thumbnail_url = updates.thumbnail_url;
    if (updates.video_url !== undefined) item.video_url = updates.video_url;
    if (updates.read_time_minutes !== undefined) item.read_time_minutes = updates.read_time_minutes;
    item.updated_at = new Date().toISOString();

    return { ...item };
  }

  public async softDeleteContent(id: string): Promise<boolean> {
    const item = this.content.get(id);
    if (!item) return false;
    item.status = 'archived';
    item.updated_at = new Date().toISOString();
    return true;
  }

  public async registerForEvent(eventId: string, userId: string, notes?: string): Promise<EventRegistration> {
    const event = this.eventDetails.get(eventId);
    if (!event) {
      throw new Error('EVENT_NOT_FOUND: الفعالية المطلوبة غير موجودة');
    }

    const alreadyRegistered = Array.from(this.registrations.values()).some(
      (r) => r.event_id === eventId && r.user_id === userId
    );

    if (alreadyRegistered) {
      const err = new Error('ALREADY_REGISTERED: لقد قمت بالتسجيل مسبقاً في هذه الفعالية');
      (err as { statusCode?: number }).statusCode = 409;
      throw err;
    }

    if (event.seats_booked >= event.seats_capacity) {
      const err = new Error('EVENT_CAPACITY_EXCEEDED: تم اكتمال المقاعد المتاحة لهذه الفعالية بالكامل');
      (err as { statusCode?: number }).statusCode = 409;
      throw err;
    }

    const regId = `reg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const reg: EventRegistration = {
      id: regId,
      event_id: eventId,
      user_id: userId,
      status: 'confirmed',
      registration_notes: notes || null,
      created_at: new Date().toISOString(),
    };

    this.registrations.set(regId, reg);
    event.seats_booked++;
    event.updated_at = new Date().toISOString();

    return reg;
  }

  public async cancelEventRegistration(eventId: string, userId: string): Promise<boolean> {
    let removed = false;
    for (const [id, r] of this.registrations.entries()) {
      if (r.event_id === eventId && r.user_id === userId) {
        this.registrations.delete(id);
        removed = true;
        break;
      }
    }

    if (removed) {
      const event = this.eventDetails.get(eventId);
      if (event) {
        event.seats_booked = Math.max(0, event.seats_booked - 1);
        event.updated_at = new Date().toISOString();
      }
      return true;
    }

    return false;
  }
}

// ============================================================================
// 4. Support In-Memory Repository
// ============================================================================
export class InMemorySupportRepository {
  private inquiries: Map<string, ContactInquiry> = new Map();

  constructor() {
    this.seed();
  }

  private seed() {
    const now = new Date().toISOString();
    const initial: ContactInquiry = {
      id: 'inq_seed_001',
      user_id: 'usr_mock_teach_01',
      full_name: 'أحمد محمود عاشور',
      email: 'ahmad@ashouracademy.com',
      phone: '+96599887766',
      subject: 'طلب تفعيل وصول المختبر الافتراضي المتقدم',
      message: 'نرجو التكرم بتفعيل تراخيص المختبر ثلاثي الأبعاد لفصول الصف التاسع.',
      portal_code: 'TEACH',
      status: 'received',
      admin_notes: null,
      assigned_to: null,
      created_at: now,
      updated_at: now,
    };
    this.inquiries.set(initial.id, initial);
  }

  public async createInquiry(
    inquiry: Omit<ContactInquiry, 'id' | 'created_at' | 'updated_at' | 'status' | 'admin_notes' | 'assigned_to'>
  ): Promise<ContactInquiry> {
    const id = `inq_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const created: ContactInquiry = {
      id,
      user_id: inquiry.user_id || null,
      full_name: inquiry.full_name.trim(),
      email: inquiry.email.trim().toLowerCase(),
      phone: inquiry.phone || null,
      subject: inquiry.subject.trim(),
      message: inquiry.message.trim(),
      portal_code: inquiry.portal_code || null,
      status: 'received',
      admin_notes: null,
      assigned_to: null,
      created_at: now,
      updated_at: now,
    };

    this.inquiries.set(id, created);
    return created;
  }

  public async listInquiries(filters: ContactFilterParams = {}): Promise<PaginatedResult<ContactInquiry>> {
    let all = Array.from(this.inquiries.values());

    if (filters.status) {
      all = all.filter((i) => i.status === filters.status);
    }
    if (filters.portal_code) {
      all = all.filter((i) => i.portal_code === filters.portal_code);
    }
    if (filters.user_id) {
      all = all.filter((i) => i.user_id === filters.user_id);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      all = all.filter(
        (i) =>
          i.full_name.toLowerCase().includes(q) ||
          i.email.toLowerCase().includes(q) ||
          i.subject.toLowerCase().includes(q) ||
          i.message.toLowerCase().includes(q)
      );
    }

    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = all.length;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 15));
    const offset = filters.offset ?? (page - 1) * limit;

    return {
      data: all.slice(offset, offset + limit),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    };
  }

  public async getInquiryById(id: string): Promise<ContactInquiry | null> {
    return this.inquiries.get(id) || null;
  }

  public async updateInquiryStatus(
    id: string,
    status: InquiryStatus,
    adminNotes?: string,
    assignedTo?: string
  ): Promise<ContactInquiry> {
    const inquiry = this.inquiries.get(id);
    if (!inquiry) throw new Error('INQUIRY_NOT_FOUND: طلب الاستفسار غير موجود');

    inquiry.status = status;
    if (adminNotes !== undefined) inquiry.admin_notes = adminNotes;
    if (assignedTo !== undefined) inquiry.assigned_to = assignedTo;
    inquiry.updated_at = new Date().toISOString();

    return { ...inquiry };
  }
}

export const inMemoryCommunityRepo = new InMemoryCommunityRepository();
export const inMemoryLibraryRepo = new InMemoryLibraryRepository();
export const inMemoryContentRepo = new InMemoryContentRepository();
export const inMemorySupportRepo = new InMemorySupportRepository();
