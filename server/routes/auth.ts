import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, DatabaseUnavailableError } from '../db';
import { authMiddleware, AuthRequest, generateToken } from '../middleware/auth';
import { validateLogin, validateRegister } from '../middleware/validator';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiter: max 40 auth attempts per 10 minutes
const authLimiter = createRateLimiter({ maxRequests: 40, windowMs: 10 * 60 * 1000 });
router.use(authLimiter);

/**
 * POST /api/v1/auth/register
 * Registers a new user, hashes password with bcrypt, assigns role, and returns JWT.
 */
router.post('/register', validateRegister, async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, fullName, role: requestedRole, phone, school, district } = req.body;

    // Check if user already exists
    const existingUser = db.findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'EMAIL_ALREADY_EXISTS',
        message: 'البريد الإلكتروني مسجل مسبقاً في منصة NEXORA. يرجى تسجيل الدخول أو استعادة كلمة المرور.',
      });
      return;
    }

    // Resolve Role
    const roleRecord = db.getRoleByCode(requestedRole) || db.getRoleByCode('TEACH')!;
    
    // Hash password securely with bcrypt (10 salt rounds)
    const password_hash = await bcrypt.hash(password, 10);

    // Create user and profile
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const newUser = db.createUser({
      id: userId,
      email,
      password_hash,
      role_id: roleRecord.id,
    });

    db.createProfile({
      id: `prf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      user_id: newUser.id,
      full_name: fullName,
      phone,
      school_or_org: school,
      district,
    });

    // Log Activity
    db.logActivity({
      user_id: newUser.id,
      action: 'USER_REGISTERED',
      entity_type: 'user',
      entity_id: newUser.id,
      details: { role: roleRecord.code, email },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    const sanitized = db.getSanitizedUser(newUser.id)!;
    const token = generateToken(sanitized);
    const permissions = db.getRolePermissions(roleRecord.id);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح في منصة NEXORA',
      token,
      user: sanitized,
      permissions: permissions.map(p => p.code),
    });
  } catch (err: unknown) {
    if (err instanceof DatabaseUnavailableError || (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 503)) {
      res.status(503).json({
        success: false,
        error: 'DATABASE_UNAVAILABLE',
        message: 'قاعدة بيانات PostgreSQL الدائمة غير متوفرة أو غير متصلة في بيئة الإنتاج',
      });
      return;
    }
    const message = err instanceof Error ? err.message : 'Unknown registration error';
    res.status(500).json({
      success: false,
      error: 'REGISTRATION_ERROR',
      message: 'حدث خطأ غير متوقع أثناء معالجة التسجيل',
      details: process.env.NODE_ENV !== 'production' ? message : undefined,
    });
  }
});

/**
 * POST /api/v1/auth/login
 * Validates credentials, verifies bcrypt hash, updates last login timestamp, returns JWT.
 */
router.post('/login', validateLogin, async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = db.findUserByEmail(email);
    if (!user) {
      db.logActivity({
        user_id: null,
        action: 'LOGIN_FAILED_UNKNOWN_EMAIL',
        details: { attemptedEmail: email },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.',
      });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({
        success: false,
        error: 'ACCOUNT_SUSPENDED',
        message: 'تم تعليق هذا الحساب. يرجى التواصل مع الدعم الفني لمنصة NEXORA.',
      });
      return;
    }

    // Compare bcrypt password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      db.logActivity({
        user_id: user.id,
        action: 'LOGIN_FAILED_BAD_PASSWORD',
        details: { email },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.',
      });
      return;
    }

    // Successful login: update last login & log
    db.updateUserLastLogin(user.id);
    db.logActivity({
      user_id: user.id,
      action: 'USER_LOGIN_SUCCESS',
      entity_type: 'user',
      entity_id: user.id,
      details: { email },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    const sanitized = db.getSanitizedUser(user.id)!;
    const token = generateToken(sanitized);
    const permissions = db.getRolePermissions(user.role_id);
    const profile = db.getProfileByUserId(user.id);

    res.status(200).json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        ...sanitized,
        profile,
      },
      permissions: permissions.map(p => p.code),
    });
  } catch (err: unknown) {
    if (err instanceof DatabaseUnavailableError || (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 503)) {
      res.status(503).json({
        success: false,
        error: 'DATABASE_UNAVAILABLE',
        message: 'قاعدة بيانات PostgreSQL الدائمة غير متوفرة أو غير متصلة في بيئة الإنتاج',
      });
      return;
    }
    const message = err instanceof Error ? err.message : 'Unknown login error';
    res.status(500).json({
      success: false,
      error: 'LOGIN_ERROR',
      message: 'حدث خطأ أثناء معالجة تسجيل الدخول',
      details: process.env.NODE_ENV !== 'production' ? message : undefined,
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Returns profile and permissions of authenticated user.
 */
router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const profile = db.getProfileByUserId(user.id);
  const permissions = db.getRolePermissions(user.role_id);

  res.status(200).json({
    success: true,
    user: {
      ...user,
      profile,
    },
    permissions: permissions.map(p => p.code),
  });
});

/**
 * POST /api/v1/auth/logout
 * Acknowledges user logout and records activity.
 */
router.post('/logout', authMiddleware, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    db.revokeToken(token);
  }

  // Also revoke unique JTI token identifier
  if (req.tokenClaims?.jti) {
    db.revokeToken(req.tokenClaims.jti);
  }

  // Clear session cookie if client utilized HttpOnly cookie auth
  if (req.cookies?.nexora_token) {
    res.clearCookie('nexora_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }

  db.logActivity({
    user_id: user.id,
    action: 'USER_LOGOUT',
    details: { email: user.email },
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.status(200).json({
    success: true,
    message: 'تم تسجيل الخروج من منظومة NEXORA بنجاح وإبطال جلسة الرمز',
  });
});

/**
 * POST /api/v1/auth/change-password
 * Updates the user's password securely after verifying their current password
 */
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'كلمة المرور الحالية وكلمة المرور الجديدة مطلوبتان',
      });
      return;
    }

    if (String(newPassword).length < 6) {
      res.status(400).json({
        success: false,
        error: 'WEAK_PASSWORD',
        message: 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات',
      });
      return;
    }

    const fullUser = db.findUserById(user.id);
    if (!fullUser) {
      res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'المستخدم غير مسجل',
      });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, fullUser.password_hash);
    if (!isMatch) {
      db.logActivity({
        user_id: user.id,
        action: 'PASSWORD_CHANGE_FAILED_WRONG_CURRENT',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      res.status(401).json({
        success: false,
        error: 'INVALID_CURRENT_PASSWORD',
        message: 'كلمة المرور الحالية غير صحيحة',
      });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    db.updateUserPassword(user.id, newHash);

    db.logActivity({
      user_id: user.id,
      action: 'PASSWORD_CHANGE_SUCCESS',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: 'تم تحديث كلمة المرور بنجاح في منظومة NEXORA',
    });
  } catch (err: unknown) {
    if (err instanceof DatabaseUnavailableError || (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 503)) {
      res.status(503).json({
        success: false,
        error: 'DATABASE_UNAVAILABLE',
        message: 'قاعدة بيانات PostgreSQL الدائمة غير متوفرة أو غير متصلة في بيئة الإنتاج',
      });
      return;
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'PASSWORD_CHANGE_ERROR',
      message: 'حدث خطأ أثناء محاولة تغيير كلمة المرور',
      details: process.env.NODE_ENV !== 'production' ? message : undefined,
    });
  }
});

export default router;
