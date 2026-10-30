import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, DatabaseUnavailableError, EmailAlreadyExistsError } from '../db';
import { authMiddleware, AuthRequest, generateToken } from '../middleware/auth';
import { validateLogin, validateRegister } from '../middleware/validator';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiter: max 40 auth attempts per 10 minutes
const authLimiter = createRateLimiter({ maxRequests: 40, windowMs: 10 * 60 * 1000 });
router.use(authLimiter);

/**
 * POST /api/v1/auth/register
 * Registers a new user atomically inside a PostgreSQL Transaction.
 * Generates JWT only after database COMMIT succeeds.
 */
router.post('/register', validateRegister, async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, fullName, role: requestedRole, phone, school, district } = req.body;

    // Check if user already exists
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'EMAIL_ALREADY_EXISTS',
        message: 'البريد الإلكتروني مسجل مسبقاً في منصة NEXORA. يرجى تسجيل الدخول أو استعادة كلمة المرور.',
      });
      return;
    }

    // Resolve validated educational role with safe TEACH fallback
    const targetRole = req.body.role || 'TEACH';
    const roleRecord = (await db.getRoleByCode(targetRole)) || (await db.getRoleByCode('TEACH'));
    if (!roleRecord) {
      res.status(500).json({
        success: false,
        error: 'DEFAULT_ROLE_UNAVAILABLE',
        message: 'تعذر تحديد الرتبة التعليمية الافتراضية للنظام',
      });
      return;
    }
    
    // Hash password securely with bcrypt (10 salt rounds)
    const password_hash = await bcrypt.hash(password, 10);

    // Create user and profile atomically in a single transaction
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const profileId = `prf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const { user: newUser } = await db.createUserWithProfile(
      {
        id: userId,
        email,
        password_hash,
        role_id: roleRecord.id,
      },
      {
        id: profileId,
        full_name: fullName,
        phone,
        school_or_org: school,
        district,
      }
    );

    // Log Activity
    await db.logActivity({
      user_id: newUser.id,
      action: 'USER_REGISTERED',
      entity_type: 'user',
      entity_id: newUser.id,
      details: { role: roleRecord.code, email },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    const sanitized = await db.getSanitizedUser(newUser.id);
    if (!sanitized) {
      res.status(500).json({
        success: false,
        error: 'USER_RETRIEVAL_FAILED',
        message: 'تعذر استرجاع بيانات المستخدم المنشأ',
      });
      return;
    }
    const token = generateToken(sanitized);
    const permissions = await db.getRolePermissions(roleRecord.id);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح في منصة NEXORA',
      token,
      user: sanitized,
      permissions: permissions.map(p => p.code),
    });
  } catch (err: unknown) {
    if (err instanceof EmailAlreadyExistsError || (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 409)) {
      res.status(409).json({
        success: false,
        error: 'EMAIL_ALREADY_EXISTS',
        message: 'البريد الإلكتروني مسجل مسبقاً في منصة NEXORA. يرجى تسجيل الدخول أو استعادة كلمة المرور.',
      });
      return;
    }
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
 * Validates credentials against PostgreSQL, verifies bcrypt hash, updates last login, returns JWT.
 */
router.post('/login', validateLogin, async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await db.findUserByEmail(email);
    if (!user) {
      await db.logActivity({
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
      await db.logActivity({
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
    await db.updateUserLastLogin(user.id);
    await db.logActivity({
      user_id: user.id,
      action: 'USER_LOGIN_SUCCESS',
      entity_type: 'user',
      entity_id: user.id,
      details: { email },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    const sanitized = await db.getSanitizedUser(user.id);
    if (!sanitized) {
      res.status(500).json({
        success: false,
        error: 'USER_RETRIEVAL_FAILED',
        message: 'تعذر تحميل بيانات المستخدم بعد الدخول',
      });
      return;
    }
    const token = generateToken(sanitized);
    const permissions = await db.getRolePermissions(user.role_id);
    const profile = await db.getProfileByUserId(user.id);

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
 * Returns profile and permissions of authenticated user directly from PostgreSQL.
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const profile = await db.getProfileByUserId(user.id);
    const permissions = await db.getRolePermissions(user.role_id);

    res.status(200).json({
      success: true,
      user: {
        ...user,
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
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'تعذر استرجاع بيانات الحساب',
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Acknowledges user logout and records persistent token revocation.
 */
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await db.revokeToken(token);
    }

    // Also revoke unique JTI token identifier in PostgreSQL
    if (req.tokenClaims?.jti) {
      await db.revokeToken(req.tokenClaims.jti, user.id);
    }

    // Clear session cookies if client utilized cookie auth
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
    res.clearCookie('nexora_token', cookieOptions);
    res.clearCookie('auth_token', cookieOptions);
    res.clearCookie('nexora_csrf', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    await db.logActivity({
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
  } catch (err: unknown) {
    if (err instanceof DatabaseUnavailableError || (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 503)) {
      res.status(503).json({
        success: false,
        error: 'DATABASE_UNAVAILABLE',
        message: 'قاعدة بيانات PostgreSQL الدائمة غير متوفرة أو غير متصلة في بيئة الإنتاج',
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'LOGOUT_ERROR',
      message: 'حدث خطأ أثناء تسجيل الخروج',
    });
  }
});

/**
 * POST /api/v1/auth/change-password
 * Updates the user's password securely in PostgreSQL after verifying their current password
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

    const fullUser = await db.findUserById(user.id);
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
      await db.logActivity({
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
    const updated = await db.updateUserPassword(user.id, newHash);
    if (!updated) {
      res.status(500).json({
        success: false,
        error: 'PASSWORD_UPDATE_FAILED',
        message: 'تعذر تحديث كلمة المرور في قاعدة البيانات',
      });
      return;
    }

    // Revoke current session tokens on password change
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      await db.revokeToken(authHeader.split(' ')[1]);
    }
    if (req.tokenClaims?.jti) {
      await db.revokeToken(req.tokenClaims.jti, user.id);
    }

    await db.logActivity({
      user_id: user.id,
      action: 'PASSWORD_CHANGE_SUCCESS',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: 'تم تحديث كلمة المرور بنجاح في منظومة NEXORA وإبطال الجلسات السابقة',
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
