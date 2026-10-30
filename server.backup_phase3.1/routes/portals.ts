import { Router, Request, Response } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/portals
 * Lists all active portals, roles, and allowed permissions
 */
router.get('/', (_req: Request, res: Response) => {
  const roles = db.getRoles();

  const portals = roles.map(r => ({
    id: r.id.replace('role_', ''),
    code: r.code,
    name: r.name,
    description: r.description,
    permissions: db.getRolePermissions(r.id).map(p => ({
      code: p.code,
      name: p.name,
      module: p.module,
    })),
  }));

  res.status(200).json({
    success: true,
    totalPortals: portals.length,
    portals,
  });
});

/**
 * GET /api/v1/portals/:code/access
 * Validates whether the authenticated user has access rights to the requested portal
 */
router.get('/:code/access', authMiddleware, (req: AuthRequest, res: Response) => {
  const requestedCode = req.params.code.toUpperCase();
  const user = req.user!;
  const userRole = user.role_code.toUpperCase();

  const targetRole = db.getRoleByCode(requestedCode);
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

  const permissions = db.getRolePermissions(targetRole.id);
  res.status(200).json({
    success: true,
    message: `تم التحقق من صلاحية الوصول لبوابة ${targetRole.name}`,
    portal: {
      code: targetRole.code,
      name: targetRole.name,
      userEmail: user.email,
    },
    permissions: permissions.map(p => p.code),
  });
});

export default router;
