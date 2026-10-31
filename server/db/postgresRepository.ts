import crypto from 'crypto';
import { query, withTransaction, getPostgresPool } from './postgres';
import { User, UserProfile, Role, Permission, ActivityLog, SanitizedUser } from './types';

/**
 * Production PostgreSQL Repository for NEXORA Platform
 * Implements real SQL parameterized queries against PostgreSQL schema (001_core_schema.sql).
 * Guarantees zero SQL injection vulnerabilities via parameterized queries ($1, $2...).
 * Supports atomic transactions for multi-entity creation.
 */
export class PostgresRepository {
  /**
   * Finds a user by their case-insensitive email address
   */
  public async findUserByEmail(email: string): Promise<User | null> {
    const res = await query<User>(
      'SELECT id, email, password_hash, role_id, is_active, email_verified, last_login_at, created_at, updated_at FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email.trim()]
    );
    return res.rows[0] || null;
  }

  /**
   * Finds a user by their unique primary key ID
   */
  public async findUserById(id: string): Promise<User | null> {
    const res = await query<User>(
      'SELECT id, email, password_hash, role_id, is_active, email_verified, last_login_at, created_at, updated_at FROM users WHERE id = $1 LIMIT 1',
      [id]
    );
    return res.rows[0] || null;
  }

  /**
   * Creates a user and their initial profile atomically in a single PostgreSQL transaction
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
    try {
      return await withTransaction(async (client) => {
        // 1. Insert User
        const userRes = await client.query<User>(
          `INSERT INTO users (id, email, password_hash, role_id, is_active, email_verified, created_at, updated_at)
           VALUES ($1, $2, $3, $4, TRUE, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING *`,
          [userData.id, userData.email.trim().toLowerCase(), userData.password_hash, userData.role_id]
        );
        const user = userRes.rows[0];

        // 2. Insert User Profile
        const profileRes = await client.query<UserProfile>(
          `INSERT INTO user_profiles (id, user_id, full_name, phone, school_or_org, district, bio, preferences, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            profileData.id,
            user.id,
            profileData.full_name,
            profileData.phone || null,
            profileData.school_or_org || null,
            profileData.district || null,
            profileData.bio || null,
          ]
        );
        const profile = profileRes.rows[0];

        return { user, profile };
      });
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505') {
        const constraint = 'constraint' in err ? String((err as { constraint: unknown }).constraint) : '';
        if (constraint === 'users_email_key' || constraint.toLowerCase().includes('email')) {
          const dupError = new Error('EMAIL_ALREADY_EXISTS: البريد الإلكتروني مسجل مسبقاً في قاعدة بيانات NEXORA');
          (dupError as { statusCode?: number }).statusCode = 409;
          throw dupError;
        }
        const conflictErr = new Error(`UNIQUE_VIOLATION: تعارض في البيانات المدخلة مع قيد فريد (${constraint || '23505'})`);
        (conflictErr as { statusCode?: number }).statusCode = 409;
        throw conflictErr;
      }
      throw err;
    }
  }

  /**
   * Creates a user in the users table
   */
  public async createUser(userData: {
    id: string;
    email: string;
    password_hash: string;
    role_id: string;
  }): Promise<User> {
    try {
      const res = await query<User>(
        `INSERT INTO users (id, email, password_hash, role_id, is_active, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, TRUE, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [userData.id, userData.email.trim().toLowerCase(), userData.password_hash, userData.role_id]
      );
      return res.rows[0];
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505') {
        const constraint = 'constraint' in err ? String((err as { constraint: unknown }).constraint) : '';
        if (constraint === 'users_email_key' || constraint.toLowerCase().includes('email')) {
          const dupError = new Error('EMAIL_ALREADY_EXISTS: البريد الإلكتروني مسجل مسبقاً في قاعدة بيانات NEXORA');
          (dupError as { statusCode?: number }).statusCode = 409;
          throw dupError;
        }
        const conflictErr = new Error(`UNIQUE_VIOLATION: تعارض في البيانات المدخلة مع قيد فريد (${constraint || '23505'})`);
        (conflictErr as { statusCode?: number }).statusCode = 409;
        throw conflictErr;
      }
      throw err;
    }
  }

  /**
   * Creates a profile in the user_profiles table
   */
  public async createProfile(profileData: {
    id: string;
    user_id: string;
    full_name: string;
    phone?: string;
    school_or_org?: string;
    district?: string;
    bio?: string;
  }): Promise<UserProfile> {
    const res = await query<UserProfile>(
      `INSERT INTO user_profiles (id, user_id, full_name, phone, school_or_org, district, bio, preferences, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        profileData.id,
        profileData.user_id,
        profileData.full_name,
        profileData.phone || null,
        profileData.school_or_org || null,
        profileData.district || null,
        profileData.bio || null,
      ]
    );
    return res.rows[0];
  }

  /**
   * Retrieves user profile by user_id
   */
  public async getProfileByUserId(userId: string): Promise<UserProfile | null> {
    const res = await query<UserProfile>(
      'SELECT * FROM user_profiles WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    return res.rows[0] || null;
  }

  /**
   * Updates user profile fields safely using parameterized values
   */
  public async updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.full_name !== undefined) {
      fields.push(`full_name = $${idx++}`);
      values.push(data.full_name);
    }
    if (data.phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(data.phone);
    }
    if (data.school_or_org !== undefined) {
      fields.push(`school_or_org = $${idx++}`);
      values.push(data.school_or_org);
    }
    if (data.district !== undefined) {
      fields.push(`district = $${idx++}`);
      values.push(data.district);
    }
    if (data.bio !== undefined) {
      fields.push(`bio = $${idx++}`);
      values.push(data.bio);
    }

    if (fields.length === 0) {
      return this.getProfileByUserId(userId);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const sql = `UPDATE user_profiles SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING *`;
    const res = await query<UserProfile>(sql, values);
    return res.rows[0] || null;
  }

  /**
   * Updates last login timestamp for user
   */
  public async updateUserLastLogin(userId: string): Promise<void> {
    await query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  }

  /**
   * Updates user password hash
   */
  public async updateUserPassword(userId: string, newPasswordHash: string): Promise<boolean> {
    const res = await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Activates or deactivates user account
   */
  public async setUserActive(userId: string, isActive: boolean): Promise<boolean> {
    const res = await query(
      'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [isActive, userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Updates user role assignment strictly via administrative actions
   */
  public async updateUserRole(userId: string, roleId: string): Promise<boolean> {
    const res = await query(
      'UPDATE users SET role_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [roleId, userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Persistently revokes a token by inserting its JTI into revoked_tokens
   */
  public async revokeToken(jti: string, userId?: string, expiresAt?: Date): Promise<void> {
    const trimmed = (jti || '').trim();
    const defaultExpiry = expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const safeJti = trimmed.length > 255 ? crypto.createHash('sha256').update(trimmed).digest('hex') : trimmed;
    await query(
      `INSERT INTO revoked_tokens (jti, user_id, expires_at, revoked_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (jti) DO NOTHING`,
      [safeJti, userId || null, defaultExpiry.toISOString()]
    );
  }

  /**
   * Checks if token JTI is in revoked_tokens table and not expired
   */
  public async isTokenRevoked(jti: string): Promise<boolean> {
    const trimmed = (jti || '').trim();
    const safeJti = trimmed.length > 255 ? crypto.createHash('sha256').update(trimmed).digest('hex') : trimmed;
    const res = await query(
      'SELECT 1 FROM revoked_tokens WHERE jti = $1 AND expires_at > CURRENT_TIMESTAMP LIMIT 1',
      [safeJti]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Revokes all active sessions for a user (e.g. upon password change)
   */
  public async revokeAllUserTokens(userId: string): Promise<void> {
    const now = new Date();
    const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const markerJti = `user_all_revoked_${userId}_${Math.floor(now.getTime() / 1000)}`;
    await query(
      `INSERT INTO revoked_tokens (jti, user_id, expires_at, revoked_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (jti) DO NOTHING`,
      [markerJti, userId, defaultExpiry.toISOString()]
    );
  }

  /**
   * Checks if all tokens for a user were revoked prior to the token's issued-at time
   */
  public async areTokensRevokedForUser(userId: string, tokenIssuedAtSeconds?: number): Promise<boolean> {
    if (!tokenIssuedAtSeconds) return false;
    const res = await query<{ revoked_epoch: number }>(
      `SELECT EXTRACT(EPOCH FROM revoked_at)::int as revoked_epoch
       FROM revoked_tokens
       WHERE user_id = $1 AND jti LIKE 'user_all_revoked_%'
       ORDER BY revoked_at DESC
       LIMIT 1`,
      [userId]
    );
    if (res.rows.length === 0) return false;
    const revokedEpoch = res.rows[0].revoked_epoch;
    return tokenIssuedAtSeconds <= revokedEpoch;
  }

  /**
   * Inserts an activity log entry into the relational database
   */
  public async logActivity(entry: {
    user_id: string | null;
    action: string;
    entity_type?: string | null;
    entity_id?: string | null;
    details?: Record<string, unknown>;
    ip_address?: string | null;
    user_agent?: string | null;
  }): Promise<ActivityLog> {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const res = await query<ActivityLog>(
      `INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        logId,
        entry.user_id,
        entry.action,
        entry.entity_type || null,
        entry.entity_id || null,
        JSON.stringify(entry.details || {}),
        entry.ip_address || null,
        entry.user_agent || null,
      ]
    );
    return res.rows[0];
  }

  /**
   * Queries activity logs for user or globally with capped limit
   */
  public async getActivityLogs(userId?: string, limit = 50): Promise<ActivityLog[]> {
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
    if (userId) {
      const res = await query<ActivityLog>(
        'SELECT * FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, safeLimit]
      );
      return res.rows;
    }
    const res = await query<ActivityLog>(
      'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT $1',
      [safeLimit]
    );
    return res.rows;
  }

  /**
   * Retrieves sanitized user object with role and profile
   */
  public async getSanitizedUser(userId: string): Promise<SanitizedUser | null> {
    const res = await query<{
      id: string;
      email: string;
      role_id: string;
      role_code: string;
      role_name: string;
      full_name: string | null;
      is_active: boolean;
      last_login_at: string | null;
      created_at: string;
    }>(
      `SELECT u.id, u.email, u.role_id, r.code as role_code, r.name as role_name,
              p.full_name, u.is_active, u.last_login_at, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );

    const row = res.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      role_id: row.role_id,
      role_code: row.role_code,
      role_name: row.role_name,
      full_name: row.full_name || 'مستخدم المنظومة',
      is_active: row.is_active,
      last_login_at: row.last_login_at,
      created_at: row.created_at,
    };
  }

  /**
   * Retrieves all roles
   */
  public async getRoles(): Promise<Role[]> {
    const res = await query<Role>('SELECT * FROM roles ORDER BY id ASC');
    return res.rows;
  }

  /**
   * Retrieves a role by ID
   */
  public async getRoleById(id: string): Promise<Role | null> {
    const res = await query<Role>(
      'SELECT * FROM roles WHERE id = $1 LIMIT 1',
      [id.trim()]
    );
    return res.rows[0] || null;
  }

  /**
   * Retrieves a role by code
   */
  public async getRoleByCode(code: string): Promise<Role | null> {
    const res = await query<Role>(
      `SELECT * FROM roles 
       WHERE UPPER(code) = UPPER($1) 
          OR UPPER(id) = UPPER($1) 
          OR UPPER(REPLACE(id, 'role_', '')) = UPPER($1) 
       LIMIT 1`,
      [code.trim()]
    );
    return res.rows[0] || null;
  }

  /**
   * Retrieves permissions for a role
   */
  public async getRolePermissions(roleId: string): Promise<Permission[]> {
    const res = await query<Permission>(
      `SELECT p.* FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = $1`,
      [roleId]
    );
    return res.rows;
  }
}

export const postgresRepo = new PostgresRepository();
