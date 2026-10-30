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
