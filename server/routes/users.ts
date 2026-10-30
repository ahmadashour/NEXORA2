import { Router, Response } from 'express';
import { db, DatabaseUnavailableError } from '../db';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { sanitizeInput, validateRoleUpdate } from '../middleware/validator';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

/**
 * GET /api/v1/users/profile
 * Retrieves user profile details directly from PostgreSQL
 */
router.get('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const profile = await db.getProfileByUserId(user.id);

    res.status(200).json({
      success: true,
      user,
      profile,
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
      message: 'حدث خطأ أثناء استرجاع الملف الشخصي',
    });
  }
});

/**
 * PUT /api/v1/users/profile
 * Updates user profile details in PostgreSQL. Strictly whitelists user-editable profile fields.
 * Immutable fields (id, role, role_id, is_active, email) cannot be altered through this endpoint.
 */
router.put('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { full_name, phone, school_or_org, district, bio } = req.body;

    // Strict boundary checks
    const sanitizedFullName = full_name !== undefined ? sanitizeInput(String(full_name).slice(0, 150)) : undefined;
    const sanitizedPhone = phone !== undefined ? sanitizeInput(String(phone).slice(0, 30)) : undefined;
    const sanitizedSchool = school_or_org !== undefined ? sanitizeInput(String(school_or_org).slice(0, 200)) : undefined;
    const sanitizedDistrict = district !== undefined ? sanitizeInput(String(district).slice(0, 100)) : undefined;
    const sanitizedBio = bio !== undefined ? sanitizeInput(String(bio).slice(0, 1000)) : undefined;

    const updated = await db.updateProfile(user.id, {
      full_name: sanitizedFullName,
      phone: sanitizedPhone,
      school_or_org: sanitizedSchool,
      district: sanitizedDistrict,
      bio: sanitizedBio,
    });

    await db.logActivity({
      user_id: user.id,
      action: 'USER_PROFILE_UPDATED',
      entity_type: 'user_profile',
      entity_id: user.id,
      details: {
        updatedFields: Object.keys(req.body).filter(k =>
          ['full_name', 'phone', 'school_or_org', 'district', 'bio'].includes(k)
        ),
      },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: 'تم تحديث الملف الشخصي بنجاح',
      profile: updated,
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
      message: 'حدث خطأ أثناء تحديث الملف الشخصي',
    });
  }
});

/**
 * PUT /api/v1/users/:id/role
 * Administrative role modification. Strictly protected by requireRole(['LEAD']).
 * Prevents unauthorized role escalation and creates immutable audit trail.
 */
router.put('/:id/role', requireRole(['LEAD']), validateRoleUpdate, async (req: AuthRequest, res: Response) => {
  try {
    const actor = req.user!;
    const targetUserId = req.params.id;
    const { role: newRoleCode } = req.body;

    const targetUser = await db.findUserById(targetUserId);
    if (!targetUser) {
      res.status(404).json({
        success: false,
        error: 'TARGET_USER_NOT_FOUND',
        message: 'المستخدم المستهدف غير موجود في المنظومة',
      });
      return;
    }

    const newRoleRecord = await db.getRoleByCode(newRoleCode);
    if (!newRoleRecord) {
      res.status(400).json({
        success: false,
        error: 'INVALID_ROLE',
        message: `الدور المطلوب (${newRoleCode}) غير معرف في المنظومة`,
      });
      return;
    }

    const oldRoleId = targetUser.role_id;
    const success = await db.updateUserRole(targetUserId, newRoleRecord.id);
    if (!success) {
      res.status(500).json({
        success: false,
        error: 'ROLE_UPDATE_FAILED',
        message: 'تعذر تعديل رتبة المستخدم في قاعدة البيانات',
      });
      return;
    }

    // Log immutable administrative audit entry
    await db.logActivity({
      user_id: actor.id,
      action: 'USER_ROLE_CHANGED',
      entity_type: 'user',
      entity_id: targetUserId,
      details: {
        actorId: actor.id,
        targetUserId,
        previousRoleId: oldRoleId,
        newRoleId: newRoleRecord.id,
        newRoleCode: newRoleRecord.code,
      },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    const updatedSanitized = await db.getSanitizedUser(targetUserId);

    res.status(200).json({
      success: true,
      message: `تم تعديل رتبة المستخدم إلى (${newRoleRecord.name}) بنجاح`,
      user: updatedSanitized,
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
      message: 'حدث خطأ أثناء تعديل رتبة المستخدم',
    });
  }
});

/**
 * GET /api/v1/users/activity
 * Retrieves activity logs for current user from PostgreSQL
 */
router.get('/activity', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const logs = await db.getActivityLogs(user.id, 20);

    res.status(200).json({
      success: true,
      count: logs.length,
      logs,
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
      message: 'حدث خطأ أثناء استرجاع سجل النشاطات',
    });
  }
});

export default router;
