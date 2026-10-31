import { Router, Response } from 'express';
import { db, DatabaseUnavailableError } from '../db';
import { authMiddleware, optionalAuth, AuthRequest } from '../middleware/auth';
import { apiWriteLimiter } from '../middleware/rateLimiter';
import {
  validateIdParam,
  validateCreateResource,
  validateUpdateResource,
} from '../middleware/validator';

const router = Router();

function handleDbError(err: unknown, res: Response, defaultMsg = 'حدث خطأ في الخادم') {
  if (
    err instanceof DatabaseUnavailableError ||
    (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 503)
  ) {
    res.status(503).json({
      success: false,
      error: 'DATABASE_UNAVAILABLE',
      message: 'قاعدة بيانات PostgreSQL الدائمة غير متوفرة أو غير متصلة في بيئة الإنتاج',
    });
    return;
  }
  const status = typeof err === 'object' && err !== null && 'statusCode' in err && typeof (err as any).statusCode === 'number'
    ? (err as any).statusCode
    : 500;
  const message = err instanceof Error ? err.message : defaultMsg;
  res.status(status).json({ success: false, error: 'SERVER_ERROR', message });
}

/**
 * Sanitizes library resource object to prevent leakage of internal server paths or sensitive details
 */
function sanitizeResource(res: any) {
  if (!res) return null;
  const { internal_storage_path, secret_key, ...safeData } = res;
  return safeData;
}

/**
 * GET /api/v1/library/resources
 * Lists digital library resources with filtering and pagination.
 * Guests and standard users can only view published resources.
 */
router.get('/resources', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 12));
    const category = req.query.category as any;
    const subject = req.query.subject as string | undefined;
    const grade_level = req.query.grade_level as string | undefined;
    const search = req.query.search as string | undefined;
    const requestedStatus = req.query.status as any;

    const isAdmin = req.user && ['LEAD', 'PRO'].includes(req.user.role_code.toUpperCase());

    let status: any = 'published';
    if (requestedStatus && isAdmin) {
      status = requestedStatus;
    }

    const result = await db.library.listResources({
      page,
      limit,
      category,
      subject,
      grade_level,
      status,
      search,
    });

    res.status(200).json({
      success: true,
      data: result.data.map(sanitizeResource),
      pagination: result.pagination,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'تعذر استرجاع مصادر المكتبة الرقمية');
  }
});

/**
 * GET /api/v1/library/resources/:id
 * Retrieves resource metadata by ID
 */
router.get('/resources/:id', optionalAuth, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const resource = await db.library.getResourceById(req.params.id);

    if (!resource) {
      res.status(404).json({
        success: false,
        error: 'RESOURCE_NOT_FOUND',
        message: 'المورد التعليمي المطلوب غير موجود',
      });
      return;
    }

    if (resource.status !== 'published') {
      const isAuthor = req.user && resource.author_id && req.user.id === resource.author_id;
      const isAdmin = req.user && ['LEAD', 'PRO'].includes(req.user.role_code.toUpperCase());
      if (!isAuthor && !isAdmin) {
        res.status(404).json({
          success: false,
          error: 'RESOURCE_NOT_FOUND',
          message: 'المورد المطلوب غير متاح للعرض العام',
        });
        return;
      }
    }

    res.status(200).json({
      success: true,
      resource: sanitizeResource(resource),
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'تعذر استرجاع بيانات المورد');
  }
});

/**
 * POST /api/v1/library/resources
 * Creates library resource metadata. Separate from physical file storage upload.
 */
router.post('/resources', authMiddleware, apiWriteLimiter, validateCreateResource, async (req: AuthRequest, res: Response) => {
  try {
    const permissions = await db.getRolePermissions(req.user!.role_id);
    const hasManagePerm = permissions.some((p) => p.code === 'resources:manage');
    const isAuthorized = hasManagePerm || ['TEACH', 'PRO', 'LEAD'].includes(req.user!.role_code.toUpperCase());

    if (!isAuthorized) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_RESOURCE_MANAGE',
        message: 'ليس لديك الصلاحيات الكافية لإضافة موارد إلى المكتبة الرقمية',
      });
      return;
    }

    const {
      title,
      description,
      category,
      subject,
      grade_level,
      file_url,
      file_size_bytes,
      file_type,
      mime_type,
      publisher_name,
      status,
    } = req.body;

    const resource = await db.library.createResource({
      id: '',
      title,
      description,
      category,
      subject,
      grade_level,
      author_id: req.user!.id,
      publisher_name: publisher_name || req.user!.full_name,
      file_url,
      file_size_bytes,
      file_type,
      mime_type,
      status: status || 'published',
    });

    await db.logActivity({
      user_id: req.user!.id,
      action: 'create_library_resource',
      entity_type: 'library_resource',
      entity_id: resource.id,
      details: { title: resource.title, category: resource.category },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    });

    res.status(201).json({
      success: true,
      message: 'تمت إضافة المورد إلى المكتبة الرقمية بنجاح',
      resource: sanitizeResource(resource),
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل إنشاء مورد المكتبة');
  }
});

/**
 * PATCH /api/v1/library/resources/:id
 * Updates resource metadata with strict ownership/admin verification (IDOR protection)
 */
router.patch('/resources/:id', authMiddleware, apiWriteLimiter, validateIdParam('id'), validateUpdateResource, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await db.library.getResourceById(req.params.id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'RESOURCE_NOT_FOUND',
        message: 'المورد المطلوب غير موجود',
      });
      return;
    }

    const isAuthor = existing.author_id === req.user!.id;
    const isAdmin = ['LEAD', 'PRO'].includes(req.user!.role_code.toUpperCase());

    if (!isAuthor && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_RESOURCE_UPDATE',
        message: 'ليس لديك صلاحية تعديل هذا المورد',
      });
      return;
    }

    const safeUpdates: any = {};
    if (req.body.title !== undefined) safeUpdates.title = req.body.title;
    if (req.body.description !== undefined) safeUpdates.description = req.body.description;
    if (req.body.category !== undefined) safeUpdates.category = req.body.category;
    if (req.body.subject !== undefined) safeUpdates.subject = req.body.subject;
    if (req.body.grade_level !== undefined) safeUpdates.grade_level = req.body.grade_level;
    if (req.body.status !== undefined) safeUpdates.status = req.body.status;

    const updated = await db.library.updateResource(req.params.id, safeUpdates);

    await db.logActivity({
      user_id: req.user!.id,
      action: 'update_library_resource',
      entity_type: 'library_resource',
      entity_id: req.params.id,
      details: { updatedFields: Object.keys(safeUpdates) },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    });

    res.status(200).json({
      success: true,
      message: 'تم تحديث بيانات المورد بنجاح',
      resource: sanitizeResource(updated),
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل تحديث بيانات المورد');
  }
});

/**
 * DELETE /api/v1/library/resources/:id
 * Soft deletes resource (sets status to 'archived')
 */
router.delete('/resources/:id', authMiddleware, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await db.library.getResourceById(req.params.id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'RESOURCE_NOT_FOUND',
        message: 'المورد المطلوب غير موجود',
      });
      return;
    }

    const isAuthor = existing.author_id === req.user!.id;
    const isAdmin = ['LEAD', 'PRO'].includes(req.user!.role_code.toUpperCase());

    if (!isAuthor && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_RESOURCE_DELETE',
        message: 'ليس لديك صلاحية حذف هذا المورد',
      });
      return;
    }

    const success = await db.library.softDeleteResource(req.params.id);
    if (!success) {
      res.status(400).json({
        success: false,
        error: 'DELETE_FAILED',
        message: 'تعذر أرشفة المورد',
      });
      return;
    }

    await db.logActivity({
      user_id: req.user!.id,
      action: 'delete_library_resource',
      entity_type: 'library_resource',
      entity_id: req.params.id,
      details: { softDelete: true },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    });

    res.status(200).json({
      success: true,
      message: 'تم أرشفة المورد بنجاح',
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل حذف المورد');
  }
});

/**
 * POST /api/v1/library/resources/:id/download
 * Increments download count only after verifying resource presence and access rights.
 * Returns safe download URL without exposing server internal storage paths.
 */
router.post('/resources/:id/download', optionalAuth, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const resource = await db.library.getResourceById(req.params.id);

    if (!resource) {
      res.status(404).json({
        success: false,
        error: 'RESOURCE_NOT_FOUND',
        message: 'المورد المطلوب للتنزيل غير موجود',
      });
      return;
    }

    if (resource.status !== 'published') {
      const isAuthor = req.user && resource.author_id && req.user.id === resource.author_id;
      const isAdmin = req.user && ['LEAD', 'PRO'].includes(req.user.role_code.toUpperCase());
      if (!isAuthor && !isAdmin) {
        res.status(404).json({
          success: false,
          error: 'RESOURCE_NOT_FOUND',
          message: 'المورد غير متاح للتنزيل حالياً',
        });
        return;
      }
    }

    // Only increment download count after confirming resource existence and access eligibility
    const newCount = await db.library.incrementDownloads(req.params.id);

    res.status(200).json({
      success: true,
      message: 'تم التحقق من المورد وبدء التنزيل',
      downloadUrl: resource.file_url,
      fileName: resource.title,
      fileType: resource.file_type,
      fileSizeBytes: resource.file_size_bytes,
      downloadsCount: newCount,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل تجهيز عملية التنزيل');
  }
});

export default router;
