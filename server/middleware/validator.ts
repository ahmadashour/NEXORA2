import { Request, Response, NextFunction } from 'express';

// Email regex according to RFC 5322 standard
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

export function sanitizeInput(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>]/g, '') // remove direct tag brackets
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
  req.body.role = sanitizeInput(role || 'teach').toLowerCase();

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
