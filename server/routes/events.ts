import { Router, Response } from 'express';
import { db, DatabaseUnavailableError } from '../db';
import { authMiddleware, optionalAuth, AuthRequest } from '../middleware/auth';
import { apiWriteLimiter } from '../middleware/rateLimiter';
import { validateIdParam, sanitizeInput } from '../middleware/validator';

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

  // Handle explicit 409 Conflict for event capacity or duplicate registration
  if (
    (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 409) ||
    (err instanceof Error && (err.message.includes('EVENT_CAPACITY_EXCEEDED') || err.message.includes('ALREADY_REGISTERED')))
  ) {
    const isCapacity = err instanceof Error && err.message.includes('EVENT_CAPACITY_EXCEEDED');
    res.status(409).json({
      success: false,
      error: isCapacity ? 'EVENT_CAPACITY_EXCEEDED' : 'ALREADY_REGISTERED',
      message: err instanceof Error ? err.message.replace(/^[A-Z_]+:\s*/, '') : 'تعذر إتمام التسجيل في الفعالية',
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
 * GET /api/v1/events
 * Lists all scientific events and conferences with capacity indicators and registration status
 */
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const subject = req.query.subject as string | undefined;
    const grade_level = req.query.grade_level as string | undefined;
    const search = req.query.search as string | undefined;

    const currentUserId = req.user ? req.user.id : undefined;

    const result = await db.content.listContent(
      {
        page,
        limit,
        category: 'event',
        subject,
        grade_level,
        search,
        status: 'published',
      },
      currentUserId
    );

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'تعذر استرجاع قائمة الفعاليات');
  }
});

/**
 * GET /api/v1/events/:id
 * Retrieves specific event details by event ID or content item ID
 */
router.get('/:id', optionalAuth, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user ? req.user.id : undefined;

    // Check if queried by content ID or event ID
    let event = await db.content.getEventById(req.params.id, currentUserId);
    let contentItem = null;

    if (event) {
      contentItem = await db.content.getContentById(event.content_item_id, currentUserId);
    } else {
      contentItem = await db.content.getContentById(req.params.id, currentUserId);
      if (contentItem && contentItem.event_detail) {
        event = contentItem.event_detail;
      }
    }

    if (!event) {
      res.status(404).json({
        success: false,
        error: 'EVENT_NOT_FOUND',
        message: 'الفعالية المطلوبة غير موجودة',
      });
      return;
    }

    res.status(200).json({
      success: true,
      event,
      content: contentItem,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'تعذر استرجاع بيانات الفعالية');
  }
});

/**
 * POST /api/v1/events
 * Creates a scientific event. Restricted to administrative leadership (LEAD, PRO).
 */
router.post('/', authMiddleware, apiWriteLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const isLeadership = ['LEAD', 'PRO'].includes(req.user!.role_code.toUpperCase());
    if (!isLeadership) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_EVENT_MANAGE',
        message: 'إنشاء الفعاليات الأكاديمية مقصور على القيادات ورؤساء الأقسام',
      });
      return;
    }

    const {
      title,
      description,
      subject,
      grade_level,
      event_date,
      duration_minutes,
      location_type,
      location_address,
      speaker_name,
      speaker_title,
      seats_capacity,
    } = req.body;

    if (!title || !description || !event_date || !speaker_name || !seats_capacity) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        message: 'العنوان، الوصف، تاريخ الفعالية، المتحدث، وسعة المقاعد حقول إجبارية',
      });
      return;
    }

    const cap = Number(seats_capacity);
    if (!Number.isInteger(cap) || cap <= 0) {
      res.status(400).json({
        success: false,
        error: 'INVALID_CAPACITY',
        message: 'سعة مقاعد الفعالية يجب أن تكون رقماً صحيحاً موجباً',
      });
      return;
    }

    const created = await db.content.createContentWithEvent(
      {
        id: '',
        title: sanitizeInput(title),
        description: sanitizeInput(description),
        category: 'event',
        subject: subject ? sanitizeInput(subject) : 'علوم عامة',
        grade_level: grade_level ? sanitizeInput(grade_level) : null,
        author_id: req.user!.id,
        thumbnail_url: null,
        video_url: null,
        read_time_minutes: 5,
        status: 'published',
        featured: true,
      },
      {
        event_date,
        duration_minutes: Number(duration_minutes) || 60,
        location_type: ['virtual', 'in_person', 'hybrid'].includes(location_type) ? location_type : 'virtual',
        location_address: location_address ? sanitizeInput(location_address) : null,
        speaker_name: sanitizeInput(speaker_name),
        speaker_title: speaker_title ? sanitizeInput(speaker_title) : null,
        seats_capacity: cap,
      }
    );

    await db.logActivity({
      user_id: req.user!.id,
      action: 'create_event',
      entity_type: 'event_detail',
      entity_id: created.event_detail?.id || created.id,
      details: { title: created.title, seats_capacity: cap },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الفعالية العلمية بنجاح',
      event: created.event_detail,
      content: created,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل إنشاء الفعالية');
  }
});

/**
 * PATCH /api/v1/events/:id
 * Updates event details. Restricted to administrative leadership (LEAD, PRO).
 */
router.patch('/:id', authMiddleware, apiWriteLimiter, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const isLeadership = ['LEAD', 'PRO'].includes(req.user!.role_code.toUpperCase());
    if (!isLeadership) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_EVENT_MANAGE',
        message: 'تعديل الفعاليات الأكاديمية مقصور على القيادات ورؤساء الأقسام',
      });
      return;
    }

    const event = await db.content.getEventById(req.params.id);
    if (!event) {
      res.status(404).json({
        success: false,
        error: 'EVENT_NOT_FOUND',
        message: 'الفعالية المطلوب تعديلها غير موجودة',
      });
      return;
    }

    const safeUpdates: any = {};
    if (req.body.event_date !== undefined) safeUpdates.event_date = req.body.event_date;
    if (req.body.duration_minutes !== undefined) safeUpdates.duration_minutes = Number(req.body.duration_minutes);
    if (req.body.location_type !== undefined) safeUpdates.location_type = req.body.location_type;
    if (req.body.location_address !== undefined) safeUpdates.location_address = sanitizeInput(req.body.location_address);
    if (req.body.speaker_name !== undefined) safeUpdates.speaker_name = sanitizeInput(req.body.speaker_name);
    if (req.body.speaker_title !== undefined) safeUpdates.speaker_title = sanitizeInput(req.body.speaker_title);
    if (req.body.seats_capacity !== undefined) safeUpdates.seats_capacity = Number(req.body.seats_capacity);

    const updated = await db.content.updateEventDetail(event.id, safeUpdates);

    res.status(200).json({
      success: true,
      message: 'تم تحديث بيانات الفعالية بنجاح',
      event: updated,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل تحديث الفعالية');
  }
});

/**
 * POST /api/v1/events/:id/register
 * Atomically registers the authenticated user for an event.
 * Enforces strict capacity limit check (locks event row) and uniqueness check (prevents duplicate registration).
 */
router.post('/:id/register', authMiddleware, apiWriteLimiter, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const event = await db.content.getEventById(req.params.id);
    if (!event) {
      res.status(404).json({
        success: false,
        error: 'EVENT_NOT_FOUND',
        message: 'الفعالية المطلوبة غير موجودة',
      });
      return;
    }

    const notes = req.body.notes ? sanitizeInput(req.body.notes) : undefined;
    const registration = await db.content.registerForEvent(event.id, req.user!.id, notes);

    await db.logActivity({
      user_id: req.user!.id,
      action: 'register_event',
      entity_type: 'event_registration',
      entity_id: registration.id,
      details: { event_id: event.id },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    });

    res.status(201).json({
      success: true,
      message: 'تم تأكيد تسجيلك في الفعالية بنجاح',
      registration,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل التسجيل في الفعالية');
  }
});

/**
 * DELETE /api/v1/events/:id/register
 * Cancels event registration and decrements seats booked atomically
 */
router.delete('/:id/register', authMiddleware, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const event = await db.content.getEventById(req.params.id);
    const targetEventId = event ? event.id : req.params.id;

    const cancelled = await db.content.cancelEventRegistration(targetEventId, req.user!.id);
    if (!cancelled) {
      res.status(404).json({
        success: false,
        error: 'REGISTRATION_NOT_FOUND',
        message: 'لم يتم العثور على تسجيل نشط لك في هذه الفعالية',
      });
      return;
    }

    await db.logActivity({
      user_id: req.user!.id,
      action: 'cancel_event_registration',
      entity_type: 'event_registration',
      entity_id: targetEventId,
      details: { cancelled: true },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    });

    res.status(200).json({
      success: true,
      message: 'تم إلغاء التسجيل في الفعالية بنجاح',
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل إلغاء التسجيل في الفعالية');
  }
});

export default router;
