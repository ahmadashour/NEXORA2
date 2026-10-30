import { Router, Response } from 'express';
import { db, DatabaseUnavailableError } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sanitizeInput } from '../middleware/validator';

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
 * Updates user profile details in PostgreSQL
 */
router.put('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { full_name, phone, school_or_org, district, bio } = req.body;

    const updated = await db.updateProfile(user.id, {
      full_name: full_name ? sanitizeInput(full_name) : undefined,
      phone: phone ? sanitizeInput(phone) : undefined,
      school_or_org: school_or_org ? sanitizeInput(school_or_org) : undefined,
      district: district ? sanitizeInput(district) : undefined,
      bio: bio ? sanitizeInput(bio) : undefined,
    });

    await db.logActivity({
      user_id: user.id,
      action: 'USER_PROFILE_UPDATED',
      entity_type: 'user_profile',
      entity_id: user.id,
      details: { updatedFields: Object.keys(req.body) },
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
