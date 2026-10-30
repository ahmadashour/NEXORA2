import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import portalsRouter from './routes/portals';
import aiRouter from './routes/ai';

export function createExpressApp(): Express {
  const app = express();

  // Disable information leakage header
  app.disable('x-powered-by');

  // Trust exactly 1 reverse proxy hop (Hostinger Nginx, Cloud Run)
  app.set('trust proxy', 1);

  // CORS Configuration
  const allowedOrigins = [
    'https://nexora.ashouracademy.com',
    'https://ashouracademy.com',
  ];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith('.ashouracademy.com') ||
        (process.env.NODE_ENV !== 'production' && (
          origin.endsWith('.run.app') ||
          /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        ));

      if (isAllowed) {
        return callback(null, true);
      }

      // Explicitly reject unauthorized origins
      return callback(new Error(`CORS_ORIGIN_BLOCKED: Origin '${origin}' is not permitted by NEXORA security policy.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  }));

  // Cookie parsing for HttpOnly cookies support
  app.use(cookieParser());

  // Body Parsing with safe size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Sanitize / Secure headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://generativelanguage.googleapis.com https://*.ashouracademy.com; frame-ancestors 'self';"
    );

    next();
  });

  // Request logger (safe, no passwords or tokens)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      const timestamp = new Date().toISOString();
      console.log(`[API ${timestamp}] ${req.method} ${req.path}`);
    }
    next();
  });

  // Mount API v1 Routes
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/portals', portalsRouter);
  app.use('/api/v1/ai', aiRouter);

  // Backward compatibility alias for `/api/health`
  app.use('/api/health', healthRouter);

  // 404 handler for API routes (covers /api, /api/, /api/anything)
  app.all(/^\/api(\/.*)?$/, (_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'ENDPOINT_NOT_FOUND',
      message: 'نقطة النهاية المطلوبة غير موجودة في واجهة برمجة تطبيقات NEXORA v1',
    });
  });

  // Centralized Error Handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal Server Error';

    // Handle CORS violation with explicit 403 Forbidden
    if (message.startsWith('CORS_ORIGIN_BLOCKED')) {
      res.status(403).json({
        success: false,
        error: 'CORS_FORBIDDEN',
        message: 'الأصل غير مسموح به عبر سياسة مشاركة الموارد (CORS)',
      });
      return;
    }

    // Handle persistent database unavailability in production with explicit 503 Service Unavailable
    if (
      message.includes('DATABASE_UNAVAILABLE') ||
      (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 503)
    ) {
      res.status(503).json({
        success: false,
        error: 'DATABASE_UNAVAILABLE',
        message: 'قاعدة بيانات PostgreSQL الدائمة غير متوفرة أو غير متصلة في بيئة الإنتاج',
      });
      return;
    }

    // Handle duplicate email unique constraint violations with explicit 409 Conflict
    if (
      message.includes('EMAIL_ALREADY_EXISTS') ||
      (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 409)
    ) {
      res.status(409).json({
        success: false,
        error: 'EMAIL_ALREADY_EXISTS',
        message: 'البريد الإلكتروني مسجل مسبقاً في منصة NEXORA. يرجى تسجيل الدخول أو استعادة كلمة المرور.',
      });
      return;
    }

    console.error('[SERVER ERROR]', message);

    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'حدث خطأ داخلي في الخادم',
      details: process.env.NODE_ENV !== 'production' ? message : undefined,
    });
  });

  return app;
}
