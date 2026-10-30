import { Router, Response } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sanitizeInput } from '../middleware/validator';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

/**
 * GET /api/v1/users/profile
 * Retrieves user profile details
 */
router.get('/profile', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const profile = db.getProfileByUserId(user.id);

  res.status(200).json({
    success: true,
    user,
    profile,
  });
});

/**
 * PUT /api/v1/users/profile
 * Updates user profile details
 */
router.put('/profile', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { full_name, phone, school_or_org, district, bio } = req.body;

  const updated = db.updateProfile(user.id, {
    full_name: full_name ? sanitizeInput(full_name) : undefined,
    phone: phone ? sanitizeInput(phone) : undefined,
    school_or_org: school_or_org ? sanitizeInput(school_or_org) : undefined,
    district: district ? sanitizeInput(district) : undefined,
    bio: bio ? sanitizeInput(bio) : undefined,
  });

  db.logActivity({
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
});

/**
 * GET /api/v1/users/activity
 * Retrieves activity logs for current user
 */
router.get('/activity', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const logs = db.getActivityLogs(user.id, 20);

  res.status(200).json({
    success: true,
    count: logs.length,
    logs,
  });
});

export default router;
