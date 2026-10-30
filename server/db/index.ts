import { Role, Permission, User, UserProfile, ActivityLog, SanitizedUser } from './types';
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

  public async revokeToken(tokenOrJti: string): Promise<void> {
    this.revokedTokens.add(tokenOrJti);
  }

  public async isTokenRevoked(tokenOrJti: string): Promise<boolean> {
    return this.revokedTokens.has(tokenOrJti);
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

  public getCounts() {
    return {
      roles: this.roles.size,
      permissions: this.permissions.size,
      users: this.users.size,
      userProfiles: this.userProfiles.size,
      activityLogs: this.activityLogs.length,
      revokedTokens: this.revokedTokens.size,
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
      const roles = await postgresRepo.getRoles();
      if (roles.length > 0) return roles;
    }
    this.assertPersistenceAllowed('getRoles');
    return await this.inMemory.getRoles();
  }

  public async getRoleById(id: string): Promise<Role | null> {
    if (this.isPostgresActive()) {
      const roles = await postgresRepo.getRoles();
      const match = roles.find(r => r.id === id);
      if (match) return match;
    }
    this.assertPersistenceAllowed('getRoleById');
    return await this.inMemory.getRoleById(id);
  }

  public async getRoleByCode(code: string): Promise<Role | null> {
    if (this.isPostgresActive()) {
      const role = await postgresRepo.getRoleByCode(code);
      if (role) return role;
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

  public getStats() {
    const hasDatabaseUrl = this.isPostgresActive();
    return {
      mode: hasDatabaseUrl ? 'postgres-primary-active' : 'memory-resilient-store',
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
        : 'PostgreSQL instance is NOT reachable in this environment. Operating with offline dev sandbox.',
    };
  }
}

// Global Singleton Export
export const db = new DatabaseStore();
export { postgresRepo } from './postgresRepository';
