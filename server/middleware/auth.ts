import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db, DatabaseUnavailableError } from '../db';
import { SanitizedUser } from '../db/types';

export interface AuthRequest extends Request {
  user?: SanitizedUser;
  tokenClaims?: {
    jti?: string;
    userId: string;
    email: string;
    role: string;
    roleId: string;
    name?: string;
    exp?: number;
    iat?: number;
  };
  authMethod?: 'bearer' | 'cookie';
}

/**
 * Generates high-entropy cryptographic CSRF token for double-submit cookie verification
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const INSECURE_DEV_SECRET = 'nexora_secure_development_secret_key_3.1';

/**
 * Validates and retrieves the JWT Secret.
 * Strictly enforces that production MUST provide a strong custom JWT_SECRET.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!secret || secret.trim() === '' || secret === INSECURE_DEV_SECRET) {
      throw new Error(
        'FATAL_SECURITY_ERROR: JWT_SECRET must be configured with a strong secret key (min 32 chars) in production. Fallback secrets are strictly prohibited.'
      );
    }
    if (secret.length < 32) {
      throw new Error(
        'FATAL_SECURITY_ERROR: JWT_SECRET is too short for production use. Minimum 32 characters required.'
      );
    }
  }

  return secret || INSECURE_DEV_SECRET;
}

/**
 * Issues signed JWT with secure entropy and unique JTI identifier
 */
export function generateToken(user: SanitizedUser): string {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const jti = crypto.randomUUID();

  return jwt.sign(
    {
      jti,
      userId: user.id,
      email: user.email,
      role: user.role_code,
      roleId: user.role_id,
      name: user.full_name,
    },
    secret,
    {
      algorithm: 'HS256',
      issuer: 'nexora.ashouracademy.com',
      audience: 'nexora-users',
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    }
  );
}

/**
 * Authentication Middleware with Dual Bearer Header + HttpOnly Cookie support
 * Includes CSRF validation when sessions authenticate via Cookies.
 */
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  let token: string | null = null;
  let authMethod: 'bearer' | 'cookie' = 'bearer';

  // 1. Try Bearer Authorization Header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
    authMethod = 'bearer';
  }

  // 2. Fallback to HttpOnly Cookie if Authorization header is not supplied
  if (!token && req.cookies) {
    const cookieToken = req.cookies.nexora_token || req.cookies.auth_token;
    if (cookieToken) {
      token = cookieToken;
      authMethod = 'cookie';

      // Enforce strict CSRF protection for mutating requests when authenticating via ambient cookie
      const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
      if (mutatingMethods.includes(req.method.toUpperCase())) {
        const csrfHeader = req.headers['x-csrf-token'];
        const csrfCookie = req.cookies.nexora_csrf;

        const hasValidCsrfToken = Boolean(
          csrfCookie &&
          csrfHeader &&
          typeof csrfCookie === 'string' &&
          typeof csrfHeader === 'string' &&
          csrfCookie.length >= 16 &&
          csrfHeader === csrfCookie
        );

        if (!hasValidCsrfToken) {
          res.status(403).json({
            success: false,
            error: 'CSRF_VALIDATION_FAILED',
            message: 'طلب غير مصرح به: التحقق من أمان CSRF مطلوب عند استخدام ملفات تعريف الارتباط',
          });
          return;
        }
      }
    }
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'رمز المصادقة مفقود أو غير صالح. يرجى توفير Bearer Token أو تسجيل الدخول.',
    });
    return;
  }

  try {
    // Check if token or JTI is revoked (checks both memory and PostgreSQL revoked_tokens table)
    if (await db.isTokenRevokedAsync(token)) {
      res.status(401).json({
        success: false,
        error: 'TOKEN_REVOKED',
        message: 'تم إبطال هذا الرمز عند تسجيل الخروج، يرجى تسجيل الدخول مجدداً',
      });
      return;
    }

    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'nexora.ashouracademy.com',
      audience: 'nexora-users',
    }) as {
      jti?: string;
      userId: string;
      email: string;
      role: string;
      roleId: string;
      name?: string;
      exp?: number;
      iat?: number;
    };

    // If JTI was used, also check JTI revocation in storage
    if (decoded.jti && (await db.isTokenRevokedAsync(decoded.jti))) {
      res.status(401).json({
        success: false,
        error: 'TOKEN_REVOKED',
        message: 'تم إبطال جلسة هذا الرمز، يرجى تسجيل الدخول مجدداً',
      });
      return;
    }

    // Check if all sessions for this user were revoked (e.g. after password change)
    if (decoded.userId && (await db.areTokensRevokedForUser(decoded.userId, decoded.iat))) {
      res.status(401).json({
        success: false,
        error: 'TOKEN_REVOKED',
        message: 'تم إبطال جميع جلسات هذا الحساب لدواعي الأمان، يرجى تسجيل الدخول مجدداً',
      });
      return;
    }

    const user = await db.getSanitizedUser(decoded.userId);
    if (!user || !user.is_active) {
      res.status(401).json({
        success: false,
        error: 'USER_INACTIVE_OR_NOT_FOUND',
        message: 'الحساب غير موجود أو تم تعطيله من قِبل إدارة المنظومة',
      });
      return;
    }

    req.user = user;
    req.tokenClaims = decoded;
    req.authMethod = authMethod;
    next();
  } catch (err: unknown) {
    if (err instanceof DatabaseUnavailableError || (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 503)) {
      res.status(503).json({
        success: false,
        error: 'DATABASE_UNAVAILABLE',
        message: 'قاعدة بيانات PostgreSQL الدائمة غير متوفرة أو غير متصلة في بيئة الإنتاج',
      });
      return;
    }
    const isExpired = err instanceof jwt.TokenExpiredError;
    res.status(401).json({
      success: false,
      error: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      message: isExpired
        ? 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً'
        : 'رمز المصادقة غير صالح أو تم التلاعب به',
    });
  }
}

/**
 * Role-Based Access Control Middleware (RBAC)
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'يتطلب هذا الإجراء تسجيل الدخول أولاً',
      });
      return;
    }

    const userRoleCode = req.user.role_code.toUpperCase();
    const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());

    if (!normalizedAllowed.includes(userRoleCode)) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_ROLE',
        message: `ليس لديك الصلاحيات الكافية للوصول إلى هذه البوابة (الدور المطلوب: ${allowedRoles.join(' / ')})`,
      });
      return;
    }

    next();
  };
}

/**
 * Permission-Based Access Control Middleware
 */
export function requirePermission(permissionCode: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'يتطلب هذا الإجراء تسجيل الدخول أولاً',
      });
      return;
    }

    try {
      const permissions = await db.getRolePermissions(req.user.role_id);
      const hasPermission = permissions.some(p => p.code === permissionCode);

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_PERMISSION',
          message: `ليس لديك الصلاحية المطلوبة (${permissionCode}) للوصول إلى هذه الميزة`,
        });
        return;
      }

      next();
    } catch (err: unknown) {
      if (err instanceof DatabaseUnavailableError || (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 503)) {
        res.status(503).json({
          success: false,
          error: 'DATABASE_UNAVAILABLE',
          message: 'قاعدة بيانات PostgreSQL الدائمة غير متوفرة أو غير متصلة في بيئة الإنتاج',
        });
        return;
      }
      next(err);
    }
  };
}
