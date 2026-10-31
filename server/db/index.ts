import crypto from 'crypto';
import {
  Role, Permission, User, UserProfile, ActivityLog, SanitizedUser,
  CommunityPost, CommunityAttachment, CommunityComment, PostFilterParams, PaginatedResult, PostStatus,
  LibraryResource, ResourceFilterParams,
  ContentItem, EventDetail, EventRegistration, ContentFilterParams,
  ContactInquiry, ContactFilterParams, InquiryStatus
} from './types';
import { postgresRepo } from './postgresRepository';
import { DatabaseUnavailableError, isValidPostgresUrl } from './postgres';

export { DatabaseUnavailableError } from './postgres';

export class EmailAlreadyExistsError extends Error {
  public statusCode = 409;
  constructor(message = 'EMAIL_ALREADY_EXISTS: البريد الإلكتروني مسجل مسبقاً في منصة NEXORA. يرجى تسجيل الدخول أو استعادة كلمة المرور.') {
    super(message);
    this.name = 'EmailAlreadyExistsError';
  }
}

// Default roles definition according to Phase 3.1 & 3.2 blueprint
export const DEFAULT_ROLES: Role[] = [
  {
    id: 'role_lead',
    name: 'موجه فني للعلوم',
    code: 'LEAD',
    description: 'إشراف تربوي ومتابعة جودة التعليم والتقارير الفنية',
    is_system_role: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'role_pro',
    name: 'رئيس قسم علمي',
    code: 'PRO',
    description: 'إدارة القسم العلمي والمختبرات المدرسية وخطط الإنماء المهني',
    is_system_role: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'role_teach',
    name: 'معلم علوم',
    code: 'TEACH',
    description: 'تحضير الدروس، إدارة الفصول، والتقويم الصفي والمختبري',
    is_system_role: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'role_start',
    name: 'معلم متدرب',
    code: 'START',
    description: 'برامج التهيئة والمصاحبة المهنية وبنك التجارب التدريبية',
    is_system_role: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'role_student',
    name: 'طالب',
    code: 'STUDENT',
    description: 'المختبرات الافتراضية، الأنشطة التفاعلية، وبنك الأسئلة',
    is_system_role: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'role_family',
    name: 'ولي أمر',
    code: 'FAMILY',
    description: 'متابعة تقارير التحصيل الدراسي والتواصل الأكاديمي والأنشطة',
    is_system_role: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const DEFAULT_PERMISSIONS: Permission[] = [
  { id: 'perm_view_dashboard', name: 'عرض لوحة التحكم', code: 'portal:view', module: 'portal', description: 'عرض لوحة تحكم البوابة' },
  { id: 'perm_manage_resources', name: 'إدارة الموارد', code: 'resources:manage', module: 'resources', description: 'إضافة وتعديل الموارد' },
  { id: 'perm_access_lab', name: 'المختبر الافتراضي', code: 'lab:access', module: 'lab', description: 'استخدام مختبر العلوم' },
  { id: 'perm_access_ai', name: 'المساعد الذكي', code: 'ai:access', module: 'ai', description: 'استخدام المساعد التربوي الذكي' },
  { id: 'perm_view_reports', name: 'التقارير الإشرافية', code: 'reports:view', module: 'reports', description: 'الاطلاع على تقارير الأداء' },
  { id: 'perm_post_community', name: 'المجتمع العلمي', code: 'community:post', module: 'community', description: 'المشاركة في مجتمع المعلمين' },
];

/**
 * Isolated In-Memory Store Adapter for offline local development and test execution.
 * Only activated when process.env.DATABASE_URL is not set AND process.env.NODE_ENV !== 'production'.
 */
class InMemoryDatabaseStore {
  private roles: Map<string, Role> = new Map();
  private permissions: Map<string, Permission> = new Map();
  private users: Map<string, User> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  private activityLogs: ActivityLog[] = [];
  private rolePermissions: Map<string, Set<string>> = new Map();
  private revokedTokens: Set<string> = new Set();

  private communityPosts: Map<string, CommunityPost> = new Map();
  private communityAttachments: Map<string, CommunityAttachment[]> = new Map();
  private communityComments: Map<string, CommunityComment[]> = new Map();
  private communityLikes: Set<string> = new Set();
  private communityBookmarks: Set<string> = new Set();
  private libraryResources: Map<string, LibraryResource> = new Map();
  private contentItems: Map<string, ContentItem> = new Map();
  private eventDetails: Map<string, EventDetail> = new Map();
  private eventRegistrations: Map<string, EventRegistration> = new Map();
  private contactInquiries: Map<string, ContactInquiry> = new Map();

  constructor() {
    this.init();
  }

  private init() {
    DEFAULT_ROLES.forEach(r => this.roles.set(r.id, { ...r }));
    DEFAULT_PERMISSIONS.forEach(p => this.permissions.set(p.id, { ...p }));

    this.rolePermissions.set('role_lead', new Set(['perm_view_dashboard', 'perm_view_reports', 'perm_access_ai']));
    this.rolePermissions.set('role_pro', new Set(['perm_view_dashboard', 'perm_manage_resources', 'perm_access_lab', 'perm_access_ai']));
    this.rolePermissions.set('role_teach', new Set(['perm_view_dashboard', 'perm_manage_resources', 'perm_access_lab', 'perm_access_ai', 'perm_post_community']));
    this.rolePermissions.set('role_start', new Set(['perm_view_dashboard', 'perm_access_lab', 'perm_access_ai']));
    this.rolePermissions.set('role_student', new Set(['perm_view_dashboard', 'perm_access_lab']));
    this.rolePermissions.set('role_family', new Set(['perm_view_dashboard']));

    // Seed initial demo data for local/offline environment
    const seedTeacherId = 'usr_seed_teacher_01';
    const now = new Date().toISOString();

    const samplePost: CommunityPost = {
      id: 'post_seed_001',
      author_id: seedTeacherId,
      author_name: 'أحمد عاشور',
      author_role: 'TEACH',
      title: 'دليل التجارب الاستقصائية في الكيمياء الحديثة',
      subject: 'كيمياء',
      grade_level: 'الصف العاشر',
      summary: 'ملخص شامل وموثق لأهم تجارب الكيمياء الاستقصائية لتعزيز مهارات البحث العلمي والتطبيق المعملي.',
      content: 'يتناول هذا الدليل خطوات تطبيق تجارب الاتزان الكيميائي وسرعة التفاعلات وفق معايير الأمان المخبري.',
      status: 'published',
      likes_count: 15,
      comments_count: 1,
      bookmarks_count: 8,
      views_count: 142,
      is_pinned: true,
      tags: ['كيمياء', 'تجارب', 'استقصاء'],
      created_at: now,
      updated_at: now,
    };
    this.communityPosts.set(samplePost.id, samplePost);
    this.communityComments.set(samplePost.id, [
      {
        id: 'comment_seed_001',
        post_id: samplePost.id,
        author_id: 'usr_seed_lead_01',
        author_name: 'د. عبد الله الموجه',
        content: 'دليل متميز ومطابق للمعايير الإشرافية الحديثة، بارك الله في جهودكم.',
        status: 'published',
        parent_comment_id: null,
        created_at: now,
        updated_at: now,
      }
    ]);

    const sampleResource: LibraryResource = {
      id: 'res_seed_001',
      title: 'حقيبة أوراق العمل التفاعلية في الفيزياء العامة',
      description: 'أوراق عمل وأنشطة مهارية شاملة لوحدات الحركة والديناميكا والكهرباء الساكنة.',
      category: 'worksheets',
      subject: 'فيزياء',
      grade_level: 'الصف الحادي عشر',
      author_id: seedTeacherId,
      publisher_name: 'أكاديمية عاشور التعليمية',
      file_url: 'https://nexora.ashouracademy.com/library/worksheets-physics-g11.pdf',
      file_size_bytes: 4194304,
      file_type: 'pdf',
      mime_type: 'application/pdf',
      status: 'published',
      downloads_count: 87,
      views_count: 320,
      created_at: now,
      updated_at: now,
    };
    this.libraryResources.set(sampleResource.id, sampleResource);

    const sampleEventContent: ContentItem = {
      id: 'cnt_seed_001',
      title: 'الملتقى السنوي لابتكارات الذكاء الاصطناعي في تعليم العلوم 2026',
      description: 'جلسات حوارية ومختبرات حية لاستعراض أحدث أدوات المحاكاة والذكاء الاصطناعي في الفصول والمختبرات.',
      category: 'event',
      subject: 'علوم عامة',
      grade_level: 'المرحلة الثانوية',
      author_id: seedTeacherId,
      thumbnail_url: 'https://nexora.ashouracademy.com/images/ai-science-summit.jpg',
      video_url: null,
      read_time_minutes: 10,
      status: 'published',
      featured: true,
      views_count: 450,
      created_at: now,
      updated_at: now,
    };
    const sampleEventDetail: EventDetail = {
      id: 'evt_seed_001',
      content_item_id: sampleEventContent.id,
      event_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      duration_minutes: 120,
      location_type: 'virtual',
      location_address: 'منصة NEXORA الافتراضية - القاعة الرئيسية',
      speaker_name: 'أ.د. خالد العمري',
      speaker_title: 'خبير استراتيجيات تدريس العلوم',
      seats_capacity: 50,
      seats_booked: 2,
      created_at: now,
      updated_at: now,
    };
    sampleEventContent.event_detail = sampleEventDetail;
    this.contentItems.set(sampleEventContent.id, sampleEventContent);
    this.eventDetails.set(sampleEventDetail.id, sampleEventDetail);
    this.eventDetails.set(sampleEventContent.id, sampleEventDetail);

    const sampleInquiry: ContactInquiry = {
      id: 'inq_seed_001',
      user_id: seedTeacherId,
      full_name: 'أحمد عاشور',
      email: 'ahmad@ashouracademy.com',
      phone: '0501234567',
      subject: 'طلب تفعيل حساب موجه فني إضافي للمنطقة الشرقية',
      message: 'نرجو التكرم بالاطلاع على بيانات الموجه الفني الجديد واعتماد تفعيل حسابه في المنظومة.',
      portal_code: 'TEACH',
      status: 'received',
      admin_notes: null,
      assigned_to: null,
      created_at: now,
      updated_at: now,
    };
    this.contactInquiries.set(sampleInquiry.id, sampleInquiry);
  }

  public async getRoles(): Promise<Role[]> {
    return Array.from(this.roles.values());
  }

  public async getRoleById(id: string): Promise<Role | null> {
    return this.roles.get(id) || null;
  }

  public async getRoleByCode(code: string): Promise<Role | null> {
    const upper = code.toUpperCase();
    for (const role of this.roles.values()) {
      if (
        role.code.toUpperCase() === upper ||
        role.id.toUpperCase() === upper ||
        role.id.replace('role_', '').toUpperCase() === upper
      ) {
        return role;
      }
    }
    return null;
  }

  public async getRolePermissions(roleId: string): Promise<Permission[]> {
    const permIds = this.rolePermissions.get(roleId);
    if (!permIds) return [];
    return Array.from(permIds)
      .map(id => this.permissions.get(id))
      .filter((p): p is Permission => Boolean(p));
  }

  public async findUserByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return user;
      }
    }
    return null;
  }

  public async findUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  public async createUserWithProfile(
    userData: {
      id: string;
      email: string;
      password_hash: string;
      role_id: string;
    },
    profileData: {
      id: string;
      full_name: string;
      phone?: string;
      school_or_org?: string;
      district?: string;
      bio?: string;
    }
  ): Promise<{ user: User; profile: UserProfile }> {
    const normalized = userData.email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        throw new EmailAlreadyExistsError();
      }
    }

    const now = new Date().toISOString();
    const newUser: User = {
      id: userData.id,
      email: normalized,
      password_hash: userData.password_hash,
      role_id: userData.role_id,
      is_active: true,
      email_verified: false,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    };
    this.users.set(newUser.id, newUser);

    const newProfile: UserProfile = {
      id: profileData.id,
      user_id: newUser.id,
      full_name: profileData.full_name,
      phone: profileData.phone || null,
      school_or_org: profileData.school_or_org || null,
      district: profileData.district || null,
      bio: profileData.bio || null,
      avatar_url: null,
      preferences: {},
      created_at: now,
      updated_at: now,
    };
    this.userProfiles.set(newUser.id, newProfile);

    return { user: newUser, profile: newProfile };
  }

  public async createUser(userData: {
    id: string;
    email: string;
    password_hash: string;
    role_id: string;
  }): Promise<User> {
    const normalized = userData.email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        throw new EmailAlreadyExistsError();
      }
    }
    const now = new Date().toISOString();
    const newUser: User = {
      id: userData.id,
      email: normalized,
      password_hash: userData.password_hash,
      role_id: userData.role_id,
      is_active: true,
      email_verified: false,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  public async createProfile(profileData: {
    id: string;
    user_id: string;
    full_name: string;
    phone?: string;
    school_or_org?: string;
    district?: string;
    bio?: string;
  }): Promise<UserProfile> {
    const now = new Date().toISOString();
    const newProfile: UserProfile = {
      id: profileData.id,
      user_id: profileData.user_id,
      full_name: profileData.full_name,
      phone: profileData.phone || null,
      school_or_org: profileData.school_or_org || null,
      district: profileData.district || null,
      bio: profileData.bio || null,
      avatar_url: null,
      preferences: {},
      created_at: now,
      updated_at: now,
    };
    this.userProfiles.set(profileData.user_id, newProfile);
    return newProfile;
  }

  public async getProfileByUserId(userId: string): Promise<UserProfile | null> {
    return this.userProfiles.get(userId) || null;
  }

  public async updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile | null> {
    const existing = this.userProfiles.get(userId);
    if (!existing) return null;
    const updated: UserProfile = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.userProfiles.set(userId, updated);
    return updated;
  }

  public async updateUserLastLogin(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.last_login_at = new Date().toISOString();
      user.updated_at = new Date().toISOString();
    }
  }

  public async updateUserPassword(userId: string, newPasswordHash: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;
    user.password_hash = newPasswordHash;
    user.updated_at = new Date().toISOString();
    return true;
  }

  public async setUserActive(userId: string, isActive: boolean): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;
    user.is_active = isActive;
    user.updated_at = new Date().toISOString();
    return true;
  }

  public async updateUserRole(userId: string, roleId: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;
    user.role_id = roleId;
    user.updated_at = new Date().toISOString();
    return true;
  }

  private normalizeToken(tokenOrJti: string): string {
    const trimmed = (tokenOrJti || '').trim();
    return trimmed.length > 255
      ? crypto.createHash('sha256').update(trimmed).digest('hex')
      : trimmed;
  }

  public async revokeToken(tokenOrJti: string): Promise<void> {
    this.revokedTokens.add(this.normalizeToken(tokenOrJti));
  }

  public async isTokenRevoked(tokenOrJti: string): Promise<boolean> {
    return this.revokedTokens.has(this.normalizeToken(tokenOrJti));
  }

  private userRevocationTimestamps = new Map<string, number>();

  public async revokeAllUserTokens(userId: string): Promise<void> {
    this.userRevocationTimestamps.set(userId, Math.floor(Date.now() / 1000));
  }

  public async areTokensRevokedForUser(userId: string, tokenIssuedAtSeconds?: number): Promise<boolean> {
    const revokedBefore = this.userRevocationTimestamps.get(userId);
    if (!revokedBefore) return false;
    if (!tokenIssuedAtSeconds) return true;
    return tokenIssuedAtSeconds <= revokedBefore;
  }

  public async logActivity(entry: {
    user_id: string | null;
    action: string;
    entity_type?: string | null;
    entity_id?: string | null;
    details?: Record<string, unknown>;
    ip_address?: string | null;
    user_agent?: string | null;
  }): Promise<ActivityLog> {
    const log: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: entry.user_id,
      action: entry.action,
      entity_type: entry.entity_type || null,
      entity_id: entry.entity_id || null,
      details: entry.details || {},
      ip_address: entry.ip_address || null,
      user_agent: entry.user_agent || null,
      created_at: new Date().toISOString(),
    };
    this.activityLogs.unshift(log);
    if (this.activityLogs.length > 1000) {
      this.activityLogs.pop();
    }
    return log;
  }

  public async getActivityLogs(userId?: string, limit = 50): Promise<ActivityLog[]> {
    if (!userId) {
      return this.activityLogs.slice(0, limit);
    }
    return this.activityLogs.filter(l => l.user_id === userId).slice(0, limit);
  }

  public async getSanitizedUser(userId: string): Promise<SanitizedUser | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    const role = this.roles.get(user.role_id);
    const profile = this.userProfiles.get(userId);

    return {
      id: user.id,
      email: user.email,
      role_id: user.role_id,
      role_code: role ? role.code : 'UNKNOWN',
      role_name: role ? role.name : 'مستخدم',
      full_name: profile ? profile.full_name : 'مستخدم المنظومة',
      is_active: user.is_active,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
    };
  }

  public community = {
    listPosts: async (filters: PostFilterParams = {}, currentUserId?: string): Promise<PaginatedResult<CommunityPost>> => {
      const page = Math.max(1, filters.page || 1);
      const limit = Math.min(50, Math.max(1, filters.limit || 10));
      const offset = (page - 1) * limit;

      let posts = Array.from(this.communityPosts.values());

      if (filters.status) {
        posts = posts.filter(p => p.status === filters.status);
      } else {
        posts = posts.filter(p => p.status === 'published');
      }

      if (filters.subject) {
        posts = posts.filter(p => p.subject.toLowerCase() === filters.subject!.toLowerCase());
      }
      if (filters.grade_level) {
        posts = posts.filter(p => p.grade_level.toLowerCase() === filters.grade_level!.toLowerCase());
      }
      if (filters.author_id) {
        posts = posts.filter(p => p.author_id === filters.author_id);
      }
      if (filters.tag) {
        posts = posts.filter(p => p.tags && p.tags.includes(filters.tag!));
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        posts = posts.filter(p =>
          p.title.toLowerCase().includes(q) ||
          p.summary.toLowerCase().includes(q) ||
          (p.content && p.content.toLowerCase().includes(q))
        );
      }

      posts.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const total = posts.length;
      const paginated = posts.slice(offset, offset + limit).map(p => {
        const item = { ...p };
        if (currentUserId) {
          item.is_liked_by_me = this.communityLikes.has(`${p.id}:${currentUserId}`);
          item.is_bookmarked_by_me = this.communityBookmarks.has(`${p.id}:${currentUserId}`);
        }
        return item;
      });

      return {
        data: paginated,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          hasMore: page * limit < total,
        },
      };
    },

    getPostById: async (id: string, currentUserId?: string): Promise<CommunityPost | null> => {
      const post = this.communityPosts.get(id);
      if (!post) return null;
      post.views_count += 1;
      const item = { ...post };
      if (currentUserId) {
        item.is_liked_by_me = this.communityLikes.has(`${post.id}:${currentUserId}`);
        item.is_bookmarked_by_me = this.communityBookmarks.has(`${post.id}:${currentUserId}`);
      }
      return item;
    },

    createPost: async (post: any, attachments?: any[]): Promise<CommunityPost> => {
      const postId = post.id || `post_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();
      const author = await this.getSanitizedUser(post.author_id);
      const newPost: CommunityPost = {
        id: postId,
        author_id: post.author_id,
        author_name: author ? author.full_name : 'معلم بالمنظومة',
        author_role: author ? author.role_code : 'TEACH',
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
      this.communityPosts.set(postId, newPost);

      if (attachments && attachments.length > 0) {
        const atts = attachments.map(att => ({
          id: `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          post_id: postId,
          file_name: att.file_name,
          file_path: att.file_path,
          file_size_bytes: att.file_size_bytes,
          mime_type: att.mime_type,
          file_type: att.file_type,
          created_at: now,
        }));
        this.communityAttachments.set(postId, atts);
      }
      return newPost;
    },

    updatePost: async (id: string, authorId: string, updates: any): Promise<CommunityPost> => {
      const post = this.communityPosts.get(id);
      if (!post) throw new Error('POST_NOT_FOUND: المنشور غير موجود');
      if (post.author_id !== authorId) {
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
    },

    softDeletePost: async (id: string, authorId: string, isAdmin = false): Promise<boolean> => {
      const post = this.communityPosts.get(id);
      if (!post) return false;
      if (!isAdmin && post.author_id !== authorId) return false;
      post.status = 'archived';
      post.updated_at = new Date().toISOString();
      return true;
    },

    toggleLike: async (postId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> => {
      const post = this.communityPosts.get(postId);
      if (!post) throw new Error('POST_NOT_FOUND: المنشور غير موجود');
      const key = `${postId}:${userId}`;
      let liked = false;
      if (this.communityLikes.has(key)) {
        this.communityLikes.delete(key);
        post.likes_count = Math.max(0, post.likes_count - 1);
        liked = false;
      } else {
        this.communityLikes.add(key);
        post.likes_count += 1;
        liked = true;
      }
      return { liked, likesCount: post.likes_count };
    },

    addLike: async (postId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> => {
      const post = this.communityPosts.get(postId);
      if (!post) throw new Error('POST_NOT_FOUND: المنشور غير موجود');
      const key = `${postId}:${userId}`;
      if (!this.communityLikes.has(key)) {
        this.communityLikes.add(key);
        post.likes_count += 1;
      }
      return { liked: true, likesCount: post.likes_count };
    },

    removeLike: async (postId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> => {
      const post = this.communityPosts.get(postId);
      if (!post) throw new Error('POST_NOT_FOUND: المنشور غير موجود');
      const key = `${postId}:${userId}`;
      if (this.communityLikes.has(key)) {
        this.communityLikes.delete(key);
        post.likes_count = Math.max(0, post.likes_count - 1);
      }
      return { liked: false, likesCount: post.likes_count };
    },

    toggleBookmark: async (postId: string, userId: string): Promise<{ bookmarked: boolean; bookmarksCount: number }> => {
      const post = this.communityPosts.get(postId);
      if (!post) throw new Error('POST_NOT_FOUND: المنشور غير موجود');
      const key = `${postId}:${userId}`;
      let bookmarked = false;
      if (this.communityBookmarks.has(key)) {
        this.communityBookmarks.delete(key);
        post.bookmarks_count = Math.max(0, post.bookmarks_count - 1);
        bookmarked = false;
      } else {
        this.communityBookmarks.add(key);
        post.bookmarks_count += 1;
        bookmarked = true;
      }
      return { bookmarked, bookmarksCount: post.bookmarks_count };
    },

    addBookmark: async (postId: string, userId: string): Promise<{ bookmarked: boolean; bookmarksCount: number }> => {
      const post = this.communityPosts.get(postId);
      if (!post) throw new Error('POST_NOT_FOUND: المنشور غير موجود');
      const key = `${postId}:${userId}`;
      if (!this.communityBookmarks.has(key)) {
        this.communityBookmarks.add(key);
        post.bookmarks_count += 1;
      }
      return { bookmarked: true, bookmarksCount: post.bookmarks_count };
    },

    removeBookmark: async (postId: string, userId: string): Promise<{ bookmarked: boolean; bookmarksCount: number }> => {
      const post = this.communityPosts.get(postId);
      if (!post) throw new Error('POST_NOT_FOUND: المنشور غير موجود');
      const key = `${postId}:${userId}`;
      if (this.communityBookmarks.has(key)) {
        this.communityBookmarks.delete(key);
        post.bookmarks_count = Math.max(0, post.bookmarks_count - 1);
      }
      return { bookmarked: false, bookmarksCount: post.bookmarks_count };
    },

    listBookmarks: async (userId: string, pagination: { page?: number; limit?: number } = {}): Promise<PaginatedResult<CommunityPost>> => {
      const page = Math.max(1, pagination.page || 1);
      const limit = Math.min(50, Math.max(1, pagination.limit || 10));
      const offset = (page - 1) * limit;

      const bookmarkedPosts: CommunityPost[] = [];
      for (const key of this.communityBookmarks) {
        const [postId, bUserId] = key.split(':');
        if (bUserId === userId) {
          const post = this.communityPosts.get(postId);
          if (post) {
            bookmarkedPosts.push({
              ...post,
              is_liked_by_me: this.communityLikes.has(`${post.id}:${userId}`),
              is_bookmarked_by_me: true,
            });
          }
        }
      }

      const total = bookmarkedPosts.length;
      return {
        data: bookmarkedPosts.slice(offset, offset + limit),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          hasMore: page * limit < total,
        },
      };
    },

    addComment: async (postId: string, authorId: string, content: string, parentCommentId?: string): Promise<CommunityComment> => {
      const post = this.communityPosts.get(postId);
      if (!post) throw new Error('POST_NOT_FOUND: المنشور غير موجود');
      const trimmed = content.trim();
      if (!trimmed) throw new Error('COMMENT_EMPTY: محتوى التعليق لا يمكن أن يكون فارغاً');

      const author = await this.getSanitizedUser(authorId);
      const commentId = `comment_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();
      const newComment: CommunityComment = {
        id: commentId,
        post_id: postId,
        author_id: authorId,
        author_name: author ? author.full_name : 'معلم بالمنظومة',
        content: trimmed,
        status: 'published',
        parent_comment_id: parentCommentId || null,
        created_at: now,
        updated_at: now,
      };

      const existingComments = this.communityComments.get(postId) || [];
      existingComments.push(newComment);
      this.communityComments.set(postId, existingComments);

      post.comments_count += 1;
      return newComment;
    },

    listComments: async (postId: string): Promise<CommunityComment[]> => {
      const comments = this.communityComments.get(postId) || [];
      return comments.filter(c => c.status === 'published').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    },
  };

  public library = {
    listResources: async (filters: ResourceFilterParams = {}): Promise<PaginatedResult<LibraryResource>> => {
      const page = Math.max(1, filters.page || 1);
      const limit = Math.min(50, Math.max(1, filters.limit || 12));
      const offset = (page - 1) * limit;

      let resources = Array.from(this.libraryResources.values());

      if (filters.status) {
        resources = resources.filter(r => r.status === filters.status);
      } else {
        resources = resources.filter(r => r.status === 'published');
      }

      if (filters.category) {
        resources = resources.filter(r => r.category === filters.category);
      }
      if (filters.subject) {
        resources = resources.filter(r => r.subject.toLowerCase() === filters.subject!.toLowerCase());
      }
      if (filters.grade_level) {
        resources = resources.filter(r => r.grade_level.toLowerCase() === filters.grade_level!.toLowerCase());
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        resources = resources.filter(r =>
          r.title.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (r.publisher_name && r.publisher_name.toLowerCase().includes(q))
        );
      }

      resources.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const total = resources.length;
      return {
        data: resources.slice(offset, offset + limit),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          hasMore: page * limit < total,
        },
      };
    },

    getResourceById: async (id: string): Promise<LibraryResource | null> => {
      const resource = this.libraryResources.get(id);
      if (!resource) return null;
      resource.views_count += 1;
      return { ...resource };
    },

    createResource: async (resource: any): Promise<LibraryResource> => {
      const id = resource.id || `res_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();
      const newRes: LibraryResource = {
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
      this.libraryResources.set(id, newRes);
      return newRes;
    },

    updateResource: async (id: string, updates: any): Promise<LibraryResource> => {
      const res = this.libraryResources.get(id);
      if (!res) throw new Error('RESOURCE_NOT_FOUND: المورد غير موجود');
      if (updates.title !== undefined) res.title = updates.title.trim();
      if (updates.description !== undefined) res.description = updates.description;
      if (updates.category !== undefined) res.category = updates.category;
      if (updates.subject !== undefined) res.subject = updates.subject.trim();
      if (updates.grade_level !== undefined) res.grade_level = updates.grade_level.trim();
      if (updates.status !== undefined) res.status = updates.status;
      res.updated_at = new Date().toISOString();
      return { ...res };
    },

    softDeleteResource: async (id: string): Promise<boolean> => {
      const res = this.libraryResources.get(id);
      if (!res) return false;
      res.status = 'archived';
      res.updated_at = new Date().toISOString();
      return true;
    },

    incrementDownloads: async (id: string): Promise<number> => {
      const res = this.libraryResources.get(id);
      if (!res) throw new Error('RESOURCE_NOT_FOUND: المورد غير موجود');
      res.downloads_count += 1;
      res.updated_at = new Date().toISOString();
      return res.downloads_count;
    },
  };

  public content = {
    listContent: async (filters: ContentFilterParams = {}, currentUserId?: string): Promise<PaginatedResult<ContentItem>> => {
      const page = Math.max(1, filters.page || 1);
      const limit = Math.min(50, Math.max(1, filters.limit || 10));
      const offset = (page - 1) * limit;

      let items = Array.from(this.contentItems.values());

      if (filters.status) {
        items = items.filter(c => c.status === filters.status);
      } else {
        items = items.filter(c => c.status === 'published');
      }

      if (filters.category) {
        items = items.filter(c => c.category === filters.category);
      }
      if (filters.subject) {
        items = items.filter(c => c.subject && c.subject.toLowerCase() === filters.subject!.toLowerCase());
      }
      if (filters.grade_level) {
        items = items.filter(c => c.grade_level && c.grade_level.toLowerCase() === filters.grade_level!.toLowerCase());
      }
      if (filters.featured !== undefined) {
        items = items.filter(c => c.featured === filters.featured);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        items = items.filter(c => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
      }

      items.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const total = items.length;
      const data = items.slice(offset, offset + limit).map(item => {
        const copy = { ...item };
        const event = this.eventDetails.get(item.id);
        if (event) {
          copy.event_detail = {
            ...event,
            is_registered_by_me: currentUserId ? Array.from(this.eventRegistrations.values()).some(r => r.event_id === event.id && r.user_id === currentUserId) : false,
          };
        }
        return copy;
      });

      return {
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          hasMore: page * limit < total,
        },
      };
    },

    getContentById: async (id: string, currentUserId?: string): Promise<ContentItem | null> => {
      const item = this.contentItems.get(id);
      if (!item) return null;
      item.views_count += 1;
      const copy = { ...item };
      const event = this.eventDetails.get(item.id) || this.eventDetails.get(id);
      if (event) {
        copy.event_detail = {
          ...event,
          is_registered_by_me: currentUserId ? Array.from(this.eventRegistrations.values()).some(r => r.event_id === event.id && r.user_id === currentUserId) : false,
        };
      }
      return copy;
    },

    createContentWithEvent: async (content: any, eventDetail?: any): Promise<ContentItem> => {
      const contentId = content.id || `cnt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();
      const newItem: ContentItem = {
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
        const newEvent: EventDetail = {
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
        newItem.event_detail = newEvent;
        this.eventDetails.set(eventId, newEvent);
        this.eventDetails.set(contentId, newEvent);
      }

      this.contentItems.set(contentId, newItem);
      return newItem;
    },

    updateContent: async (id: string, updates: any): Promise<ContentItem> => {
      const item = this.contentItems.get(id);
      if (!item) throw new Error('CONTENT_NOT_FOUND: عنصر المحتوى غير موجود');
      if (updates.title !== undefined) item.title = updates.title.trim();
      if (updates.description !== undefined) item.description = updates.description.trim();
      if (updates.category !== undefined) item.category = updates.category;
      if (updates.subject !== undefined) item.subject = updates.subject;
      if (updates.grade_level !== undefined) item.grade_level = updates.grade_level;
      if (updates.thumbnail_url !== undefined) item.thumbnail_url = updates.thumbnail_url;
      if (updates.video_url !== undefined) item.video_url = updates.video_url;
      if (updates.read_time_minutes !== undefined) item.read_time_minutes = updates.read_time_minutes;
      if (updates.status !== undefined) item.status = updates.status;
      if (updates.featured !== undefined) item.featured = updates.featured;
      item.updated_at = new Date().toISOString();
      return { ...item };
    },

    softDeleteContent: async (id: string): Promise<boolean> => {
      const item = this.contentItems.get(id);
      if (!item) return false;
      item.status = 'archived';
      item.updated_at = new Date().toISOString();
      return true;
    },

    getEventById: async (eventId: string, currentUserId?: string): Promise<EventDetail | null> => {
      const event = this.eventDetails.get(eventId);
      if (!event) return null;
      const copy = { ...event };
      if (currentUserId) {
        copy.is_registered_by_me = Array.from(this.eventRegistrations.values()).some(r => r.event_id === event.id && r.user_id === currentUserId);
      }
      return copy;
    },

    updateEventDetail: async (eventId: string, updates: any): Promise<EventDetail> => {
      const event = this.eventDetails.get(eventId);
      if (!event) throw new Error('EVENT_NOT_FOUND: الفعالية غير موجودة');
      if (updates.event_date !== undefined) event.event_date = updates.event_date;
      if (updates.duration_minutes !== undefined) event.duration_minutes = updates.duration_minutes;
      if (updates.location_type !== undefined) event.location_type = updates.location_type;
      if (updates.location_address !== undefined) event.location_address = updates.location_address;
      if (updates.speaker_name !== undefined) event.speaker_name = updates.speaker_name.trim();
      if (updates.speaker_title !== undefined) event.speaker_title = updates.speaker_title;
      if (updates.seats_capacity !== undefined) event.seats_capacity = updates.seats_capacity;
      event.updated_at = new Date().toISOString();
      return { ...event };
    },

    registerForEvent: async (eventId: string, userId: string, notes?: string): Promise<EventRegistration> => {
      const event = this.eventDetails.get(eventId);
      if (!event) throw new Error('EVENT_NOT_FOUND: الفعالية المطلوبة غير موجودة');

      if (event.seats_booked >= event.seats_capacity) {
        const err = new Error('EVENT_CAPACITY_EXCEEDED: تم اكتمال المقاعد المتاحة لهذه الفعالية بالكامل');
        (err as { statusCode?: number }).statusCode = 409;
        throw err;
      }

      const existingReg = Array.from(this.eventRegistrations.values()).find(r => r.event_id === event.id && r.user_id === userId);
      if (existingReg) {
        const err = new Error('ALREADY_REGISTERED: لقد قمت بالتسجيل مسبقاً في هذه الفعالية');
        (err as { statusCode?: number }).statusCode = 409;
        throw err;
      }

      const regId = `reg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();
      const reg: EventRegistration = {
        id: regId,
        event_id: event.id,
        user_id: userId,
        status: 'confirmed',
        registration_notes: notes || null,
        created_at: now,
      };

      this.eventRegistrations.set(regId, reg);
      event.seats_booked += 1;
      event.updated_at = now;
      return reg;
    },

    cancelEventRegistration: async (eventId: string, userId: string): Promise<boolean> => {
      const event = this.eventDetails.get(eventId);
      const regEntry = Array.from(this.eventRegistrations.entries()).find(([_, r]) => (r.event_id === eventId || (event && r.event_id === event.id)) && r.user_id === userId);
      if (!regEntry) return false;

      this.eventRegistrations.delete(regEntry[0]);
      if (event) {
        event.seats_booked = Math.max(0, event.seats_booked - 1);
        event.updated_at = new Date().toISOString();
      }
      return true;
    },
  };

  public support = {
    createInquiry: async (inquiry: any): Promise<ContactInquiry> => {
      const id = `inq_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();
      const newInq: ContactInquiry = {
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
      this.contactInquiries.set(id, newInq);
      return newInq;
    },

    listInquiries: async (filters: ContactFilterParams = {}): Promise<PaginatedResult<ContactInquiry>> => {
      const page = Math.max(1, filters.page || 1);
      const limit = Math.min(50, Math.max(1, filters.limit || 15));
      const offset = (page - 1) * limit;

      let inqs = Array.from(this.contactInquiries.values());

      if (filters.status) {
        inqs = inqs.filter(i => i.status === filters.status);
      }
      if (filters.user_id) {
        inqs = inqs.filter(i => i.user_id === filters.user_id);
      }
      if (filters.portal_code) {
        inqs = inqs.filter(i => i.portal_code === filters.portal_code);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        inqs = inqs.filter(i =>
          i.full_name.toLowerCase().includes(q) ||
          i.email.toLowerCase().includes(q) ||
          i.subject.toLowerCase().includes(q) ||
          i.message.toLowerCase().includes(q)
        );
      }

      inqs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const total = inqs.length;
      return {
        data: inqs.slice(offset, offset + limit),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          hasMore: page * limit < total,
        },
      };
    },

    getInquiryById: async (id: string): Promise<ContactInquiry | null> => {
      return this.contactInquiries.get(id) || null;
    },

    updateInquiryStatus: async (id: string, status: InquiryStatus, adminNotes?: string, assignedTo?: string): Promise<ContactInquiry> => {
      const inq = this.contactInquiries.get(id);
      if (!inq) throw new Error('INQUIRY_NOT_FOUND: طلب الاستفسار غير موجود');
      inq.status = status;
      if (adminNotes !== undefined) inq.admin_notes = adminNotes;
      if (assignedTo !== undefined) inq.assigned_to = assignedTo;
      inq.updated_at = new Date().toISOString();
      return { ...inq };
    },
  };

  public getCounts() {
    return {
      roles: this.roles.size,
      permissions: this.permissions.size,
      users: this.users.size,
      userProfiles: this.userProfiles.size,
      activityLogs: this.activityLogs.length,
      revokedTokens: this.revokedTokens.size,
      communityPosts: this.communityPosts.size,
      communityAttachments: this.communityAttachments.size,
      communityComments: this.communityComments.size,
      communityLikes: this.communityLikes.size,
      communityBookmarks: this.communityBookmarks.size,
      libraryResources: this.libraryResources.size,
      contentItems: this.contentItems.size,
      eventDetails: this.eventDetails.size,
      eventRegistrations: this.eventRegistrations.size,
      contactInquiries: this.contactInquiries.size,
    };
  }
}

/**
 * Primary Database Store
 * Implements Phase 3.2 Primary PostgreSQL Architecture.
 * When process.env.DATABASE_URL is set, all operations execute directly and exclusively on PostgreSQL.
 * In production (NODE_ENV=production), persistent database connection is mandatory; zero silent in-memory fallback.
 */
class DatabaseStore {
  private inMemory = new InMemoryDatabaseStore();

  public isPostgresActive(): boolean {
    return isValidPostgresUrl(process.env.DATABASE_URL);
  }

  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private assertPersistenceAllowed(operation: string): void {
    if (this.isProduction() && !this.isPostgresActive()) {
      if (process.env.ALLOW_INSECURE_DEV_MEMORY === 'true') {
        console.warn(`[AI STUDIO DB] ALLOW_INSECURE_DEV_MEMORY enabled — using in-memory store for: ${operation}`);
        return;
      }
      throw new DatabaseUnavailableError(
        `DATABASE_UNAVAILABLE: Cannot perform persistent operation '${operation}'. PostgreSQL connection (DATABASE_URL) is required in production.`
      );
    }
  }

  public async findUserByEmail(email: string): Promise<User | null> {
    if (this.isPostgresActive()) {
      return await postgresRepo.findUserByEmail(email);
    }
    this.assertPersistenceAllowed('findUserByEmail');
    return await this.inMemory.findUserByEmail(email);
  }

  public async findUserById(id: string): Promise<User | null> {
    if (this.isPostgresActive()) {
      return await postgresRepo.findUserById(id);
    }
    this.assertPersistenceAllowed('findUserById');
    return await this.inMemory.findUserById(id);
  }

  /**
   * Atomic multi-entity creation (User + UserProfile) executed inside a single PostgreSQL Transaction
   */
  public async createUserWithProfile(
    userData: {
      id: string;
      email: string;
      password_hash: string;
      role_id: string;
    },
    profileData: {
      id: string;
      full_name: string;
      phone?: string;
      school_or_org?: string;
      district?: string;
      bio?: string;
    }
  ): Promise<{ user: User; profile: UserProfile }> {
    if (this.isPostgresActive()) {
      return await postgresRepo.createUserWithProfile(userData, profileData);
    }
    this.assertPersistenceAllowed('createUserWithProfile');
    return await this.inMemory.createUserWithProfile(userData, profileData);
  }

  public async createUser(userData: {
    id: string;
    email: string;
    password_hash: string;
    role_id: string;
  }): Promise<User> {
    if (this.isPostgresActive()) {
      return await postgresRepo.createUser(userData);
    }
    this.assertPersistenceAllowed('createUser');
    return await this.inMemory.createUser(userData);
  }

  public async createProfile(profileData: {
    id: string;
    user_id: string;
    full_name: string;
    phone?: string;
    school_or_org?: string;
    district?: string;
    bio?: string;
  }): Promise<UserProfile> {
    if (this.isPostgresActive()) {
      return await postgresRepo.createProfile(profileData);
    }
    this.assertPersistenceAllowed('createProfile');
    return await this.inMemory.createProfile(profileData);
  }

  public async getProfileByUserId(userId: string): Promise<UserProfile | null> {
    if (this.isPostgresActive()) {
      return await postgresRepo.getProfileByUserId(userId);
    }
    this.assertPersistenceAllowed('getProfileByUserId');
    return await this.inMemory.getProfileByUserId(userId);
  }

  public async updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile | null> {
    if (this.isPostgresActive()) {
      return await postgresRepo.updateProfile(userId, data);
    }
    this.assertPersistenceAllowed('updateProfile');
    return await this.inMemory.updateProfile(userId, data);
  }

  public async updateUserLastLogin(userId: string): Promise<void> {
    if (this.isPostgresActive()) {
      await postgresRepo.updateUserLastLogin(userId);
      return;
    }
    this.assertPersistenceAllowed('updateUserLastLogin');
    await this.inMemory.updateUserLastLogin(userId);
  }

  public async updateUserPassword(userId: string, newPasswordHash: string): Promise<boolean> {
    if (this.isPostgresActive()) {
      return await postgresRepo.updateUserPassword(userId, newPasswordHash);
    }
    this.assertPersistenceAllowed('updateUserPassword');
    return await this.inMemory.updateUserPassword(userId, newPasswordHash);
  }

  public async setUserActive(userId: string, isActive: boolean): Promise<boolean> {
    if (this.isPostgresActive()) {
      return await postgresRepo.setUserActive(userId, isActive);
    }
    this.assertPersistenceAllowed('setUserActive');
    return await this.inMemory.setUserActive(userId, isActive);
  }

  public async updateUserRole(userId: string, roleId: string): Promise<boolean> {
    if (this.isPostgresActive()) {
      return await postgresRepo.updateUserRole(userId, roleId);
    }
    this.assertPersistenceAllowed('updateUserRole');
    return await this.inMemory.updateUserRole(userId, roleId);
  }

  public async revokeToken(tokenOrJti: string, userId?: string, expiresAt?: Date): Promise<void> {
    if (this.isPostgresActive()) {
      await postgresRepo.revokeToken(tokenOrJti, userId, expiresAt);
      return;
    }
    this.assertPersistenceAllowed('revokeToken');
    await this.inMemory.revokeToken(tokenOrJti);
  }

  public async isTokenRevoked(tokenOrJti: string): Promise<boolean> {
    if (this.isPostgresActive()) {
      return await postgresRepo.isTokenRevoked(tokenOrJti);
    }
    return await this.inMemory.isTokenRevoked(tokenOrJti);
  }

  public async isTokenRevokedAsync(tokenOrJti: string): Promise<boolean> {
    return this.isTokenRevoked(tokenOrJti);
  }

  public async revokeAllUserTokens(userId: string): Promise<void> {
    if (this.isPostgresActive()) {
      await postgresRepo.revokeAllUserTokens(userId);
    }
    await this.inMemory.revokeAllUserTokens(userId);
  }

  public async areTokensRevokedForUser(userId: string, tokenIssuedAtSeconds?: number): Promise<boolean> {
    if (this.isPostgresActive()) {
      const isRevoked = await postgresRepo.areTokensRevokedForUser(userId, tokenIssuedAtSeconds);
      if (isRevoked) return true;
    }
    return await this.inMemory.areTokensRevokedForUser(userId, tokenIssuedAtSeconds);
  }

  public async logActivity(entry: {
    user_id: string | null;
    action: string;
    entity_type?: string | null;
    entity_id?: string | null;
    details?: Record<string, unknown>;
    ip_address?: string | null;
    user_agent?: string | null;
  }): Promise<ActivityLog> {
    if (this.isPostgresActive()) {
      return await postgresRepo.logActivity(entry);
    }
    this.assertPersistenceAllowed('logActivity');
    return await this.inMemory.logActivity(entry);
  }

  public async getActivityLogs(userId?: string, limit = 50): Promise<ActivityLog[]> {
    if (this.isPostgresActive()) {
      return await postgresRepo.getActivityLogs(userId, limit);
    }
    this.assertPersistenceAllowed('getActivityLogs');
    return await this.inMemory.getActivityLogs(userId, limit);
  }

  public async getSanitizedUser(userId: string): Promise<SanitizedUser | null> {
    if (this.isPostgresActive()) {
      return await postgresRepo.getSanitizedUser(userId);
    }
    this.assertPersistenceAllowed('getSanitizedUser');
    return await this.inMemory.getSanitizedUser(userId);
  }

  public async getRoles(): Promise<Role[]> {
    if (this.isPostgresActive()) {
      return await postgresRepo.getRoles();
    }
    this.assertPersistenceAllowed('getRoles');
    return await this.inMemory.getRoles();
  }

  public async getRoleById(id: string): Promise<Role | null> {
    if (this.isPostgresActive()) {
      return await postgresRepo.getRoleById(id);
    }
    this.assertPersistenceAllowed('getRoleById');
    return await this.inMemory.getRoleById(id);
  }

  public async getRoleByCode(code: string): Promise<Role | null> {
    if (this.isPostgresActive()) {
      return await postgresRepo.getRoleByCode(code);
    }
    this.assertPersistenceAllowed('getRoleByCode');
    return await this.inMemory.getRoleByCode(code);
  }

  public async getRolePermissions(roleId: string): Promise<Permission[]> {
    if (this.isPostgresActive()) {
      return await postgresRepo.getRolePermissions(roleId);
    }
    this.assertPersistenceAllowed('getRolePermissions');
    return await this.inMemory.getRolePermissions(roleId);
  }

  /**
   * Domain Sub-Repositories for Phase 5 P1.2
   */
  public get community() {
    if (this.isPostgresActive()) return postgresRepo.community;
    this.assertPersistenceAllowed('community');
    return this.inMemory.community;
  }

  public get library() {
    if (this.isPostgresActive()) return postgresRepo.library;
    this.assertPersistenceAllowed('library');
    return this.inMemory.library;
  }

  public get content() {
    if (this.isPostgresActive()) return postgresRepo.content;
    this.assertPersistenceAllowed('content');
    return this.inMemory.content;
  }

  public get support() {
    if (this.isPostgresActive()) return postgresRepo.support;
    this.assertPersistenceAllowed('support');
    return this.inMemory.support;
  }

  public getStats() {
    const hasDatabaseUrl = this.isPostgresActive();
    return {
      mode: hasDatabaseUrl ? 'postgres-primary-active' : 'memory-resilient-store',
      status: this.isProduction() && !hasDatabaseUrl ? 'degraded_insecure_sandbox' : 'healthy',
      tables: [
        'roles', 'permissions', 'role_permissions', 'users', 'user_profiles', 'activity_logs', 'revoked_tokens',
        'community_posts', 'community_attachments', 'community_comments', 'community_likes', 'community_bookmarks',
        'library_resources', 'content_items', 'event_details', 'event_registrations', 'contact_inquiries'
      ],
      inMemoryStructures: {
        roles: 'Map<string, Role>',
        permissions: 'Map<string, Permission>',
        users: 'Map<string, User>',
        userProfiles: 'Map<string, UserProfile>',
        activityLogs: 'ActivityLog[] (max 1000 items)',
        rolePermissions: 'Map<string, Set<string>>',
        revokedTokens: 'Set<string>',
      },
      counts: this.inMemory.getCounts(),
    };
  }

  public async getDiagnostics() {
    const { checkPostgresConnection } = await import('./postgres');
    const postgresStatus = await checkPostgresConnection();

    return {
      runtimeStorage: {
        type: this.isPostgresActive()
          ? 'PostgreSQL Primary Persistence (Relational Architecture)'
          : 'In-Memory Resilient Store (Map/Set)',
        isTemporaryDevSandbox: !this.isPostgresActive(),
        isProductionPersistent: this.isPostgresActive(),
        stats: this.getStats(),
      },
      postgresConnection: {
        isConfigured: postgresStatus.isConfigured,
        isReachable: postgresStatus.isReachable,
        latencyMs: postgresStatus.latencyMs,
        serverVersion: postgresStatus.serverVersion,
        error: postgresStatus.error,
        poolState: postgresStatus.poolState,
      },
      complianceNotice: postgresStatus.isReachable
        ? 'PostgreSQL connection active and primary in accordance with Phase 3.2 blueprint.'
        : this.isProduction()
          ? 'CRITICAL: PostgreSQL instance is NOT reachable in production environment.'
          : 'PostgreSQL instance is NOT reachable in this environment. Operating with offline dev sandbox.',
    };
  }
}

// Global Singleton Export
export const db = new DatabaseStore();
export { postgresRepo } from './postgresRepository';
export { communityRepo, CommunityRepository } from './repositories/communityRepository';
export { libraryRepo, LibraryRepository } from './repositories/libraryRepository';
export { contentRepo, ContentRepository } from './repositories/contentRepository';
export { supportRepo, SupportRepository } from './repositories/supportRepository';
