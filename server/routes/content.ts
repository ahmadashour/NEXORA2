import { Router, Response } from 'express';
import { db, DatabaseUnavailableError } from '../db';
import { authMiddleware, optionalAuth, AuthRequest } from '../middleware/auth';
import { apiWriteLimiter } from '../middleware/rateLimiter';
import {
  validateIdParam,
  validateCreateContent,
  validateUpdateContent,
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
 * GET /api/v1/content
 * Lists published content items (news, articles, videos, announcements).
 * Drafts and non-published items are strictly invisible to general users.
 */
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const category = req.query.category as any;
    const subject = req.query.subject as string | undefined;
    const grade_level = req.query.grade_level as string | undefined;
    const search = req.query.search as string | undefined;
    const featured = req.query.featured !== undefined ? req.query.featured === 'true' : undefined;
    const requestedStatus = req.query.status as any;

    const isAdmin = req.user && ['LEAD', 'PRO'].includes(req.user.role_code.toUpperCase());

    let status: any = 'published';
    if (requestedStatus && isAdmin) {
      status = requestedStatus;
    }

    const currentUserId = req.user ? req.user.id : undefined;

    const result = await db.content.listContent(
      { page, limit, category, subject, grade_level, featured, search, status },
      currentUserId
    );

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'تعذر استرجاع المحتوى التعليمي');
  }
});

/**
 * GET /api/v1/content/:id
 * Retrieves single content item details and attached event details if applicable
 */
router.get('/:id', optionalAuth, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user ? req.user.id : undefined;
    const item = await db.content.getContentById(req.params.id, currentUserId);

    if (!item) {
      res.status(404).json({
        success: false,
        error: 'CONTENT_NOT_FOUND',
        message: 'عنصر المحتوى المطلوب غير موجود',
      });
      return;
    }

    if (item.status !== 'published') {
      const isAuthor = req.user && item.author_id && req.user.id === item.author_id;
      const isAdmin = req.user && ['LEAD', 'PRO'].includes(req.user.role_code.toUpperCase());
      if (!isAuthor && !isAdmin) {
        res.status(404).json({
          success: false,
          error: 'CONTENT_NOT_FOUND',
          message: 'عنصر المحتوى المطلوب غير متاح للعرض العام',
        });
        return;
      }
    }

    res.status(200).json({
      success: true,
      content: item,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'تعذر استرجاع بيانات المحتوى');
  }
});

/**
 * POST /api/v1/content
 * Creates content item (and optional event detail). Restricted to leadership/curator roles (LEAD, PRO).
 */
router.post('/', authMiddleware, apiWriteLimiter, validateCreateContent, async (req: AuthRequest, res: Response) => {
  try {
    const isLeadership = ['LEAD', 'PRO'].includes(req.user!.role_code.toUpperCase());
    if (!isLeadership) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_CONTENT_MANAGE',
        message: 'إضافة ونشر المحتوى الأكاديمي والفعاليات مقصورة على القيادات ورؤساء الأقسام',
      });
      return;
    }

    const {
      title,
      description,
      category,
      subject,
      grade_level,
      read_time_minutes,
      thumbnail_url,
      video_url,
      status,
      featured,
      eventDetail,
    } = req.body;

    const created = await db.content.createContentWithEvent(
      {
        id: '',
        title,
        description,
        category,
        subject: subject || null,
        grade_level: grade_level || null,
        author_id: req.user!.id,
        thumbnail_url: thumbnail_url || null,
        video_url: video_url || null,
        read_time_minutes: read_time_minutes || 5,
        status: status || 'published',
        featured: Boolean(featured),
      },
      eventDetail
    );

    await db.logActivity({
      user_id: req.user!.id,
      action: 'create_content_item',
      entity_type: 'content_item',
      entity_id: created.id,
      details: { title: created.title, category: created.category },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء عنصر المحتوى بنجاح',
      content: created,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل إنشاء عنصر المحتوى');
  }
});

/**
 * PATCH /api/v1/content/:id
 * Updates content item with strict role / author verification (IDOR protection)
 */
router.patch('/:id', authMiddleware, apiWriteLimiter, validateIdParam('id'), validateUpdateContent, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await db.content.getContentById(req.params.id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'CONTENT_NOT_FOUND',
        message: 'عنصر المحتوى المطلوب تعديله غير موجود',
      });
      return;
    }

    const isAuthor = existing.author_id === req.user!.id;
    const isAdmin = ['LEAD', 'PRO'].includes(req.user!.role_code.toUpperCase());

    if (!isAuthor && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_CONTENT_UPDATE',
        message: 'ليس لديك صلاحية تعديل هذا المحتوى',
      });
      return;
    }

    const updated = await db.content.updateContent(req.params.id, req.body);

    await db.logActivity({
      user_id: req.user!.id,
      action: 'update_content_item',
      entity_type: 'content_item',
      entity_id: req.params.id,
      details: { updatedKeys: Object.keys(req.body) },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    });

    res.status(200).json({
      success: true,
      message: 'تم تحديث بيانات المحتوى بنجاح',
      content: updated,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل تحديث المحتوى');
  }
});

/**
 * DELETE /api/v1/content/:id
 * Soft deletes content item (sets status to 'archived')
 */
router.delete('/:id', authMiddleware, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await db.content.getContentById(req.params.id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'CONTENT_NOT_FOUND',
        message: 'عنصر المحتوى غير موجود',
      });
      return;
    }

    const isAuthor = existing.author_id === req.user!.id;
    const isAdmin = ['LEAD', 'PRO'].includes(req.user!.role_code.toUpperCase());

    if (!isAuthor && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_CONTENT_DELETE',
        message: 'ليس لديك صلاحية حذف هذا المحتوى',
      });
      return;
    }

    const success = await db.content.softDeleteContent(req.params.id);
    if (!success) {
      res.status(400).json({
        success: false,
        error: 'DELETE_FAILED',
        message: 'تعذر أرشفة عنصر المحتوى',
      });
      return;
    }

    await db.logActivity({
      user_id: req.user!.id,
      action: 'delete_content_item',
      entity_type: 'content_item',
      entity_id: req.params.id,
      details: { softDelete: true },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    });

    res.status(200).json({
      success: true,
      message: 'تم أرشفة عنصر المحتوى بنجاح',
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل حذف المحتوى');
  }
});

export default router;
