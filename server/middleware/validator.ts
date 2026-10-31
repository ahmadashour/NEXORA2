import { Request, Response, NextFunction } from 'express';

// Email regex according to RFC 5322 standard
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

export function sanitizeInput(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\0/g, '') // remove null bytes
    .replace(/[<>]/g, '') // strip HTML tag angle brackets
    .replace(/javascript:/gi, '') // strip pseudo javascript: protocols
    .replace(/data:/gi, '')
    .trim();
}

export function validateRegister(req: Request, res: Response, next: NextFunction): void {
  const { email, password, fullName, role } = req.body || {};

  if (!email || !password || !fullName) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_FAILED',
      message: 'البريد الإلكتروني، كلمة المرور، والاسم الكامل حقول إجبارية',
    });
    return;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  if (!EMAIL_REGEX.test(cleanEmail)) {
    res.status(400).json({
      success: false,
      error: 'INVALID_EMAIL_FORMAT',
      message: 'صيغة البريد الإلكتروني المدخلة غير صحيحة',
    });
    return;
  }

  if (String(password).length < 6) {
    res.status(400).json({
      success: false,
      error: 'WEAK_PASSWORD',
      message: 'يجب ألا تقل كلمة المرور عن 6 خانات للأمان الأكاديمي',
    });
    return;
  }

  if (String(fullName).trim().length < 2) {
    res.status(400).json({
      success: false,
      error: 'INVALID_NAME',
      message: 'يرجى إدخال اسم كامل صحيح (حرفان على الأقل)',
    });
    return;
  }

  // Sanitize values
  req.body.email = cleanEmail;
  req.body.fullName = sanitizeInput(fullName);
  // Educational role validation: allow valid platform roles, strictly normalize arbitrary/unknown roles to TEACH
  const ALLOWED_EDUCATIONAL_ROLES = ['LEAD', 'PRO', 'TEACH', 'START', 'STUDENT', 'FAMILY'];
  if (role && typeof role === 'string' && ALLOWED_EDUCATIONAL_ROLES.includes(role.trim().toUpperCase())) {
    req.body.role = role.trim().toUpperCase();
  } else {
    req.body.role = 'TEACH';
  }

  next();
}

export function validateRoleUpdate(req: Request, res: Response, next: NextFunction): void {
  const { role } = req.body || {};
  if (!role || typeof role !== 'string' || role.trim() === '') {
    res.status(400).json({
      success: false,
      error: 'ROLE_REQUIRED',
      message: 'رمز الدور المطلوب إسناده إجباري',
    });
    return;
  }

  const normalized = sanitizeInput(role).toUpperCase();
  const ALLOWED_ROLES = ['LEAD', 'PRO', 'TEACH', 'START', 'STUDENT', 'FAMILY'];
  if (!ALLOWED_ROLES.includes(normalized)) {
    res.status(400).json({
      success: false,
      error: 'INVALID_ROLE',
      message: `الدور المحدد غير معتمد. الأدوار المتاحة: ${ALLOWED_ROLES.join(', ')}`,
    });
    return;
  }

  req.body.role = normalized;
  next();
}

export function validateLogin(req: Request, res: Response, next: NextFunction): void {
  const { email, password } = req.body || {};

  if (!email || !password) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_FAILED',
      message: 'يرجى تقديم البريد الإلكتروني وكلمة المرور',
    });
    return;
  }

  req.body.email = String(email).trim().toLowerCase();
  next();
}

/**
 * Validates that a route ID parameter matches safe alphanumeric/ID patterns.
 * Prevents SQL injection and path traversal attempts via malformed IDs.
 */
export function validateIdParam(paramName = 'id') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const val = req.params[paramName];
    if (!val || typeof val !== 'string' || !/^[a-zA-Z0-9_-]{2,64}$/.test(val)) {
      res.status(400).json({
        success: false,
        error: 'INVALID_ID_FORMAT',
        message: `معرف المورد المطلوب (${paramName}) غير صالح أو غير مطابق للصيغة القياسية`,
      });
      return;
    }
    next();
  };
}

export function validateCreatePost(req: Request, res: Response, next: NextFunction): void {
  const { title, subject, grade_level, summary, content, tags, status } = req.body || {};

  if (!title || !subject || !grade_level || !summary) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_FAILED',
      message: 'العنوان، المادة، المرحلة الدراسية، والملخص حقول إجبارية لنشر المشاركة',
    });
    return;
  }

  const cleanTitle = sanitizeInput(title);
  if (cleanTitle.length < 3 || cleanTitle.length > 255) {
    res.status(400).json({
      success: false,
      error: 'INVALID_TITLE',
      message: 'عنوان المنشور يجب أن يتراوح بين 3 و255 حرفاً',
    });
    return;
  }

  const cleanSummary = sanitizeInput(summary);
  if (cleanSummary.length < 5 || cleanSummary.length > 1000) {
    res.status(400).json({
      success: false,
      error: 'INVALID_SUMMARY',
      message: 'ملخص المنشور يجب ألا يقل عن 5 أحرف ولا يتجاوز 1000 حرف',
    });
    return;
  }

  const allowedStatuses = ['draft', 'review', 'published'];
  const finalStatus = status && allowedStatuses.includes(status) ? status : 'published';

  req.body.title = cleanTitle;
  req.body.subject = sanitizeInput(subject);
  req.body.grade_level = sanitizeInput(grade_level);
  req.body.summary = cleanSummary;
  req.body.content = content ? sanitizeInput(content) : null;
  req.body.status = finalStatus;
  req.body.tags = Array.isArray(tags) ? tags.map(t => sanitizeInput(t)).filter(Boolean).slice(0, 10) : [];

  next();
}

export function validateUpdatePost(req: Request, res: Response, next: NextFunction): void {
  const { title, subject, grade_level, summary, content, tags, status } = req.body || {};

  const allowedStatuses = ['draft', 'review', 'published', 'hidden', 'archived'];
  if (status !== undefined && !allowedStatuses.includes(status)) {
    res.status(400).json({
      success: false,
      error: 'INVALID_STATUS',
      message: 'حالة المنشور المدخلة غير معتمدة',
    });
    return;
  }

  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = sanitizeInput(title);
  if (subject !== undefined) updates.subject = sanitizeInput(subject);
  if (grade_level !== undefined) updates.grade_level = sanitizeInput(grade_level);
  if (summary !== undefined) updates.summary = sanitizeInput(summary);
  if (content !== undefined) updates.content = content ? sanitizeInput(content) : null;
  if (status !== undefined) updates.status = status;
  if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags.map(t => sanitizeInput(t)).filter(Boolean) : [];

  if (Object.keys(updates).length === 0) {
    res.status(400).json({
      success: false,
      error: 'EMPTY_UPDATE',
      message: 'يرجى تقديم حقل واحد على الأقل للتعديل',
    });
    return;
  }

  req.body = updates;
  next();
}

export function validateCreateComment(req: Request, res: Response, next: NextFunction): void {
  const { content } = req.body || {};
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'COMMENT_REQUIRED',
      message: 'محتوى التعليق مطلوب ولا يمكن تركه فارغاً',
    });
    return;
  }

  const clean = sanitizeInput(content);
  if (clean.length > 1000) {
    res.status(400).json({
      success: false,
      error: 'COMMENT_TOO_LONG',
      message: 'محتوى التعليق يتجاوز الحد الأقصى (1000 حرف)',
    });
    return;
  }

  req.body.content = clean;
  next();
}

export function validateCreateResource(req: Request, res: Response, next: NextFunction): void {
  const { title, description, category, subject, grade_level, file_url, file_size_bytes, file_type, mime_type, publisher_name, status } = req.body || {};

  if (!title || !category || !subject || !grade_level || !file_url) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_FAILED',
      message: 'العنوان، التصنيف، المادة، المرحلة الدراسية، ورابط الملف حقول إجبارية',
    });
    return;
  }

  const allowedCategories = ['books', 'guides', 'worksheets', 'exams', 'curriculum', 'research'];
  if (!allowedCategories.includes(category)) {
    res.status(400).json({
      success: false,
      error: 'INVALID_CATEGORY',
      message: `التصنيف المحدد غير معتمد. التصنيفات المعتمدة: ${allowedCategories.join(', ')}`,
    });
    return;
  }

  req.body.title = sanitizeInput(title);
  req.body.description = description ? sanitizeInput(description) : null;
  req.body.category = category;
  req.body.subject = sanitizeInput(subject);
  req.body.grade_level = sanitizeInput(grade_level);
  req.body.file_url = sanitizeInput(file_url);
  req.body.file_size_bytes = Number(file_size_bytes) || 1048576;
  req.body.file_type = file_type ? sanitizeInput(file_type) : 'pdf';
  req.body.mime_type = mime_type ? sanitizeInput(mime_type) : 'application/pdf';
  req.body.publisher_name = publisher_name ? sanitizeInput(publisher_name) : null;
  req.body.status = status && ['draft', 'review', 'published'].includes(status) ? status : 'published';

  next();
}

export function validateUpdateResource(req: Request, res: Response, next: NextFunction): void {
  const { title, description, category, subject, grade_level, status } = req.body || {};
  const allowedCategories = ['books', 'guides', 'worksheets', 'exams', 'curriculum', 'research'];
  if (category !== undefined && !allowedCategories.includes(category)) {
    res.status(400).json({
      success: false,
      error: 'INVALID_CATEGORY',
      message: 'التصنيف المحدد غير معتمد',
    });
    return;
  }

  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = sanitizeInput(title);
  if (description !== undefined) updates.description = description ? sanitizeInput(description) : null;
  if (category !== undefined) updates.category = category;
  if (subject !== undefined) updates.subject = sanitizeInput(subject);
  if (grade_level !== undefined) updates.grade_level = sanitizeInput(grade_level);
  if (status !== undefined) updates.status = status;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({
      success: false,
      error: 'EMPTY_UPDATE',
      message: 'يرجى تقديم حقل واحد على الأقل للتعديل',
    });
    return;
  }

  req.body = updates;
  next();
}

export function validateCreateContent(req: Request, res: Response, next: NextFunction): void {
  const { title, description, category, subject, grade_level, read_time_minutes, thumbnail_url, video_url, status, featured, eventDetail } = req.body || {};

  if (!title || !description || !category) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_FAILED',
      message: 'العنوان، الوصف، والتصنيف حقول إجبارية لعنصر المحتوى',
    });
    return;
  }

  const allowedCategories = ['article', 'video', 'news', 'event', 'announcement'];
  if (!allowedCategories.includes(category)) {
    res.status(400).json({
      success: false,
      error: 'INVALID_CATEGORY',
      message: `تصنيف المحتوى غير معتمد. الخيارات: ${allowedCategories.join(', ')}`,
    });
    return;
  }

  if (category === 'event') {
    if (!eventDetail || !eventDetail.event_date || !eventDetail.speaker_name || !eventDetail.seats_capacity) {
      res.status(400).json({
        success: false,
        error: 'EVENT_DETAIL_REQUIRED',
        message: 'محتوى الفعالية يتطلب تحديد تاريخ الانعقاد، اسم المتحدث، والسعة المقعدية',
      });
      return;
    }
    const cap = Number(eventDetail.seats_capacity);
    if (!Number.isInteger(cap) || cap <= 0) {
      res.status(400).json({
        success: false,
        error: 'INVALID_CAPACITY',
        message: 'سعة الفعالية يجب أن تكون رقماً صحيحاً أكبر من الصفر',
      });
      return;
    }
  }

  req.body.title = sanitizeInput(title);
  req.body.description = sanitizeInput(description);
  req.body.category = category;
  req.body.subject = subject ? sanitizeInput(subject) : null;
  req.body.grade_level = grade_level ? sanitizeInput(grade_level) : null;
  req.body.read_time_minutes = Number(read_time_minutes) || 5;
  req.body.thumbnail_url = thumbnail_url ? sanitizeInput(thumbnail_url) : null;
  req.body.video_url = video_url ? sanitizeInput(video_url) : null;
  req.body.status = status && ['draft', 'published'].includes(status) ? status : 'published';
  req.body.featured = Boolean(featured);

  if (eventDetail) {
    req.body.eventDetail = {
      event_date: eventDetail.event_date,
      duration_minutes: Number(eventDetail.duration_minutes) || 60,
      location_type: ['virtual', 'in_person', 'hybrid'].includes(eventDetail.location_type) ? eventDetail.location_type : 'virtual',
      location_address: eventDetail.location_address ? sanitizeInput(eventDetail.location_address) : null,
      speaker_name: sanitizeInput(eventDetail.speaker_name),
      speaker_title: eventDetail.speaker_title ? sanitizeInput(eventDetail.speaker_title) : null,
      seats_capacity: Number(eventDetail.seats_capacity),
    };
  }

  next();
}

export function validateUpdateContent(req: Request, res: Response, next: NextFunction): void {
  const { title, description, category, subject, grade_level, thumbnail_url, video_url, read_time_minutes, status, featured } = req.body || {};

  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = sanitizeInput(title);
  if (description !== undefined) updates.description = sanitizeInput(description);
  if (category !== undefined) updates.category = category;
  if (subject !== undefined) updates.subject = subject ? sanitizeInput(subject) : null;
  if (grade_level !== undefined) updates.grade_level = grade_level ? sanitizeInput(grade_level) : null;
  if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url ? sanitizeInput(thumbnail_url) : null;
  if (video_url !== undefined) updates.video_url = video_url ? sanitizeInput(video_url) : null;
  if (read_time_minutes !== undefined) updates.read_time_minutes = Number(read_time_minutes);
  if (status !== undefined) updates.status = status;
  if (featured !== undefined) updates.featured = Boolean(featured);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({
      success: false,
      error: 'EMPTY_UPDATE',
      message: 'يرجى تقديم حقل واحد على الأقل للتعديل',
    });
    return;
  }

  req.body = updates;
  next();
}

export function validateCreateInquiry(req: Request, res: Response, next: NextFunction): void {
  const { full_name, email, phone, subject, message, portal_code } = req.body || {};

  if (!full_name || !email || !subject || !message) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_FAILED',
      message: 'الاسم الكامل، البريد الإلكتروني، عنوان الاستفسار، والرسالة حقول إجبارية',
    });
    return;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  if (!EMAIL_REGEX.test(cleanEmail)) {
    res.status(400).json({
      success: false,
      error: 'INVALID_EMAIL_FORMAT',
      message: 'صيغة البريد الإلكتروني غير صحيحة',
    });
    return;
  }

  const cleanMessage = sanitizeInput(message);
  if (cleanMessage.length < 5 || cleanMessage.length > 3000) {
    res.status(400).json({
      success: false,
      error: 'INVALID_MESSAGE_LENGTH',
      message: 'نص الرسالة يجب أن يتراوح بين 5 و3000 حرف',
    });
    return;
  }

  req.body.full_name = sanitizeInput(full_name);
  req.body.email = cleanEmail;
  req.body.phone = phone ? sanitizeInput(phone) : null;
  req.body.subject = sanitizeInput(subject);
  req.body.message = cleanMessage;
  req.body.portal_code = portal_code ? sanitizeInput(portal_code).toUpperCase() : null;

  next();
}

export function validateUpdateInquiryStatus(req: Request, res: Response, next: NextFunction): void {
  const { status, admin_notes, assigned_to } = req.body || {};

  const allowedStatuses = ['received', 'in_progress', 'resolved', 'closed'];
  if (!status || !allowedStatuses.includes(status)) {
    res.status(400).json({
      success: false,
      error: 'INVALID_INQUIRY_STATUS',
      message: `حالة الاستفسار غير صالحة. الحالات المعتمدة: ${allowedStatuses.join(', ')}`,
    });
    return;
  }

  req.body.status = status;
  req.body.admin_notes = admin_notes ? sanitizeInput(admin_notes) : undefined;
  req.body.assigned_to = assigned_to ? sanitizeInput(assigned_to) : undefined;

  next();
}

