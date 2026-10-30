import { Role, Permission, User, UserProfile, ActivityLog, SanitizedUser } from './types';

// Default roles definition according to Phase 3.1 blueprint
const DEFAULT_ROLES: Role[] = [
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

const DEFAULT_PERMISSIONS: Permission[] = [
  { id: 'perm_view_dashboard', name: 'عرض لوحة التحكم', code: 'portal:view', module: 'portal', description: 'عرض لوحة تحكم البوابة' },
  { id: 'perm_manage_resources', name: 'إدارة الموارد', code: 'resources:manage', module: 'resources', description: 'إضافة وتعديل الموارد' },
  { id: 'perm_access_lab', name: 'المختبر الافتراضي', code: 'lab:access', module: 'lab', description: 'استخدام مختبر العلوم' },
  { id: 'perm_access_ai', name: 'المساعد الذكي', code: 'ai:access', module: 'ai', description: 'استخدام المساعد التربوي الذكي' },
  { id: 'perm_view_reports', name: 'التقارير الإشرافية', code: 'reports:view', module: 'reports', description: 'الاطلاع على تقارير الأداء' },
  { id: 'perm_post_community', name: 'المجتمع العلمي', code: 'community:post', module: 'community', description: 'المشاركة في مجتمع المعلمين' },
];

/**
 * Resilient Database Store
 * Implements the storage interface for NEXORA. In environments where DATABASE_URL
 * is configured with external PostgreSQL (Supabase / Hostinger), it can map to Postgres.
 * Otherwise, it transparently runs a fully consistent in-memory store so testing, development,
 * and demo workflows are completely functional without broken dependencies.
 */
class DatabaseStore {
  private roles: Map<string, Role> = new Map();
  private permissions: Map<string, Permission> = new Map();
  private users: Map<string, User> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  private activityLogs: ActivityLog[] = [];
  private rolePermissions: Map<string, Set<string>> = new Map();
  private revokedTokens: Set<string> = new Set();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    
    // Seed roles
    DEFAULT_ROLES.forEach(r => this.roles.set(r.id, { ...r }));
    
    // Seed permissions
    DEFAULT_PERMISSIONS.forEach(p => this.permissions.set(p.id, { ...p }));

    // Seed role-permission associations
    this.rolePermissions.set('role_lead', new Set(['perm_view_dashboard', 'perm_view_reports', 'perm_access_ai']));
    this.rolePermissions.set('role_pro', new Set(['perm_view_dashboard', 'perm_manage_resources', 'perm_access_lab', 'perm_access_ai']));
    this.rolePermissions.set('role_teach', new Set(['perm_view_dashboard', 'perm_manage_resources', 'perm_access_lab', 'perm_access_ai', 'perm_post_community']));
    this.rolePermissions.set('role_start', new Set(['perm_view_dashboard', 'perm_access_lab', 'perm_access_ai']));
    this.rolePermissions.set('role_student', new Set(['perm_view_dashboard', 'perm_access_lab']));
    this.rolePermissions.set('role_family', new Set(['perm_view_dashboard']));

    this.initialized = true;
  }

  public getRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  public getRoleById(id: string): Role | null {
    return this.roles.get(id) || null;
  }

  public getRoleByCode(code: string): Role | null {
    const upper = code.toUpperCase();
    for (const role of this.roles.values()) {
      if (role.code === upper || role.id.replace('role_', '').toUpperCase() === upper) {
        return role;
      }
    }
    return null;
  }

  public getRolePermissions(roleId: string): Permission[] {
    const permIds = this.rolePermissions.get(roleId);
    if (!permIds) return [];
    return Array.from(permIds)
      .map(id => this.permissions.get(id))
      .filter((p): p is Permission => Boolean(p));
  }

  public findUserByEmail(email: string): User | null {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return user;
      }
    }
    return null;
  }

  public findUserById(id: string): User | null {
    return this.users.get(id) || null;
  }

  public createUser(userData: {
    id: string;
    email: string;
    password_hash: string;
    role_id: string;
  }): User {
    const now = new Date().toISOString();
    const newUser: User = {
      id: userData.id,
      email: userData.email.trim().toLowerCase(),
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

  public createProfile(profileData: {
    id: string;
    user_id: string;
    full_name: string;
    phone?: string;
    school_or_org?: string;
    district?: string;
    bio?: string;
  }): UserProfile {
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

  public getProfileByUserId(userId: string): UserProfile | null {
    return this.userProfiles.get(userId) || null;
  }

  public updateProfile(userId: string, data: Partial<UserProfile>): UserProfile | null {
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

  public updateUserLastLogin(userId: string): void {
    const user = this.users.get(userId);
    if (user) {
      user.last_login_at = new Date().toISOString();
      user.updated_at = new Date().toISOString();
    }
  }

  public updateUserPassword(userId: string, newPasswordHash: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.password_hash = newPasswordHash;
    user.updated_at = new Date().toISOString();
    return true;
  }

  public setUserActive(userId: string, isActive: boolean): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.is_active = isActive;
    user.updated_at = new Date().toISOString();
    return true;
  }

  public revokeToken(tokenOrJti: string): void {
    this.revokedTokens.add(tokenOrJti);
  }

  public isTokenRevoked(tokenOrJti: string): boolean {
    return this.revokedTokens.has(tokenOrJti);
  }

  public logActivity(entry: {
    user_id: string | null;
    action: string;
    entity_type?: string | null;
    entity_id?: string | null;
    details?: Record<string, unknown>;
    ip_address?: string | null;
    user_agent?: string | null;
  }): ActivityLog {
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
    // Keep max 1000 logs in memory
    if (this.activityLogs.length > 1000) {
      this.activityLogs.pop();
    }
    return log;
  }

  public getActivityLogs(userId?: string, limit = 50): ActivityLog[] {
    if (!userId) {
      return this.activityLogs.slice(0, limit);
    }
    return this.activityLogs.filter(l => l.user_id === userId).slice(0, limit);
  }

  public getSanitizedUser(userId: string): SanitizedUser | null {
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

  public getStats() {
    const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
    return {
      mode: hasDatabaseUrl ? 'postgres-configured' : 'memory-resilient-store',
      status: 'healthy',
      tables: ['roles', 'permissions', 'role_permissions', 'users', 'user_profiles', 'activity_logs', 'revoked_tokens'],
      inMemoryStructures: {
        roles: 'Map<string, Role>',
        permissions: 'Map<string, Permission>',
        users: 'Map<string, User>',
        userProfiles: 'Map<string, UserProfile>',
        activityLogs: 'ActivityLog[] (max 1000 items)',
        rolePermissions: 'Map<string, Set<string>>',
        revokedTokens: 'Set<string>',
      },
      counts: {
        roles: this.roles.size,
        permissions: this.permissions.size,
        users: this.users.size,
        activityLogs: this.activityLogs.length,
        revokedTokens: this.revokedTokens.size,
      },
    };
  }

  public async getDiagnostics() {
    const { checkPostgresConnection } = await import('./postgres');
    const postgresStatus = await checkPostgresConnection();

    return {
      runtimeStorage: {
        type: 'In-Memory Resilient Store (Map/Set)',
        isTemporaryDevSandbox: true,
        isProductionPersistent: false,
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
        ? 'PostgreSQL connection active and responding.'
        : 'PostgreSQL instance is NOT reachable in this isolated environment. System is operating safely with local test storage without fake assertions.',
    };
  }
}

// Global Singleton Export
export const db = new DatabaseStore();
export { postgresRepo } from './postgresRepository';
