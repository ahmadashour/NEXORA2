import { Router, Response } from 'express';
import { db, DatabaseUnavailableError } from '../db';
import { authMiddleware, optionalAuth, AuthRequest } from '../middleware/auth';
import { inquiryLimiter, apiWriteLimiter } from '../middleware/rateLimiter';
import {
  validateIdParam,
  validateCreateInquiry,
  validateUpdateInquiryStatus,
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
 * POST /api/v1/support/inquiries
 * Submits a new support or general academic inquiry.
 * Open to public visitors and registered educational users alike.
 */
router.post('/inquiries', optionalAuth, inquiryLimiter, validateCreateInquiry, async (req: AuthRequest, res: Response) => {
  try {
    const { full_name, email, phone, subject, message, portal_code } = req.body;

    const inquiry = await db.support.createInquiry({
      user_id: req.user ? req.user.id : null,
      full_name,
      email,
      phone: phone || null,
      subject,
      message,
      portal_code: portal_code || (req.user ? req.user.role_code : null),
    });

    if (req.user) {
      await db.logActivity({
        user_id: req.user.id,
        action: 'submit_inquiry',
        entity_type: 'contact_inquiry',
        entity_id: inquiry.id,
        details: { subject: inquiry.subject },
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      });
    }

    res.status(201).json({
      success: true,
      message: 'تم استلام استفسارك بنجاح، وسيتواصل معك الفريق التربوي المختص قريباً.',
      inquiry: {
        id: inquiry.id,
        subject: inquiry.subject,
        status: inquiry.status,
        created_at: inquiry.created_at,
      },
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل إرسال الاستفسار');
  }
});

/**
 * GET /api/v1/support/inquiries
 * Lists inquiries.
 * Strict IDOR boundary: Regular users can ONLY view their own inquiries.
 * Administrative supervisors (LEAD, PRO) can view and filter all inquiries across the platform.
 */
router.get('/inquiries', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
    const status = req.query.status as any;
    const portal_code = req.query.portal_code as string | undefined;
    const search = req.query.search as string | undefined;

    const isAdmin = ['LEAD', 'PRO'].includes(req.user!.role_code.toUpperCase());

    // Scoping: If not admin, strictly scope filter to authenticated user's ID
    const filterUserId = isAdmin ? (req.query.user_id as string | undefined) : req.user!.id;

    const result = await db.support.listInquiries({
      page,
      limit,
      user_id: filterUserId,
      status: isAdmin ? status : undefined,
      portal_code,
      search,
    });

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'تعذر استرجاع الاستفسارات');
  }
});

/**
 * GET /api/v1/support/inquiries/:id
 * Retrieves specific inquiry by ID with strict ownership validation (IDOR protection)
 */
router.get('/inquiries/:id', authMiddleware, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const inquiry = await db.support.getInquiryById(req.params.id);

    if (!inquiry) {
      res.status(404).json({
        success: false,
        error: 'INQUIRY_NOT_FOUND',
        message: 'طلب الاستفسار غير موجود',
      });
      return;
    }

    const isOwner = inquiry.user_id === req.user!.id;
    const isAdmin = ['LEAD', 'PRO'].includes(req.user!.role_code.toUpperCase());

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_INQUIRY_ACCESS',
        message: 'ليس لديك صلاحية الاطلاع على تفاصيل هذا الاستفسار',
      });
      return;
    }

    res.status(200).json({
      success: true,
      inquiry,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'تعذر استرجاع تفاصيل الاستفسار');
  }
});

/**
 * PATCH /api/v1/support/inquiries/:id/status
 * Updates inquiry status, administrative notes, and assigned supervisor.
 * Restricted strictly to leadership roles (LEAD, PRO).
 */
router.patch('/inquiries/:id/status', authMiddleware, apiWriteLimiter, validateIdParam('id'), validateUpdateInquiryStatus, async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = ['LEAD', 'PRO'].includes(req.user!.role_code.toUpperCase());
    if (!isAdmin) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_INQUIRY_STATUS_UPDATE',
        message: 'تحديث حالة الاستفسارات مقصور على القيادات التربوية والمشرفين',
      });
      return;
    }

    const { status, admin_notes, assigned_to } = req.body;
    const updated = await db.support.updateInquiryStatus(req.params.id, status, admin_notes, assigned_to);

    await db.logActivity({
      user_id: req.user!.id,
      action: 'update_inquiry_status',
      entity_type: 'contact_inquiry',
      entity_id: req.params.id,
      details: { newStatus: status, assigned_to: assigned_to || null },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    });

    res.status(200).json({
      success: true,
      message: 'تم تحديث حالة الاستفسار وملاحظات المتابعة بنجاح',
      inquiry: updated,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل تحديث حالة الاستفسار');
  }
});

export default router;
