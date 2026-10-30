import { Router, Request, Response } from 'express';
import { db, DatabaseUnavailableError } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/portals
 * Lists all active portals, roles, and allowed permissions directly from PostgreSQL
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const roles = await db.getRoles();

    const portals = await Promise.all(
      roles.map(async (r) => {
        const perms = await db.getRolePermissions(r.id);
        return {
          id: r.id.replace('role_', ''),
          code: r.code,
          name: r.name,
          description: r.description,
          permissions: perms.map((p) => ({
            code: p.code,
            name: p.name,
            module: p.module,
          })),
        };
      })
    );

    res.status(200).json({
      success: true,
      totalPortals: portals.length,
      portals,
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
      message: 'تعذر استرجاع بوابات المنظومة',
    });
  }
});

/**
 * GET /api/v1/portals/:code/access
 * Validates whether the authenticated user has access rights to the requested portal
 */
router.get('/:code/access', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const requestedCode = req.params.code.toUpperCase();
    const user = req.user!;
    const userRole = user.role_code.toUpperCase();

    const targetRole = await db.getRoleByCode(requestedCode);
    if (!targetRole) {
      res.status(404).json({
        success: false,
        error: 'PORTAL_NOT_FOUND',
        message: `بوابة التعليم المطلوبة (${requestedCode}) غير موجودة`,
      });
      return;
    }

    // Exact role match isolation (each portal is restricted to its own role)
    if (userRole !== requestedCode) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_PORTAL_ACCESS',
        message: `عذراً، لا يملك حسابك (${userRole}) صلاحية الدخول المباشر إلى بوابة (${requestedCode})`,
        currentRole: userRole,
        targetPortal: requestedCode,
      });
      return;
    }

    const permissions = await db.getRolePermissions(targetRole.id);
    res.status(200).json({
      success: true,
      message: `تم التحقق من صلاحية الوصول لبوابة ${targetRole.name}`,
      portal: {
        code: targetRole.code,
        name: targetRole.name,
        userEmail: user.email,
      },
      permissions: permissions.map((p) => p.code),
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
      message: 'حدث خطأ أثناء فحص إذن الوصول للبوابة',
    });
  }
});

export default router;
