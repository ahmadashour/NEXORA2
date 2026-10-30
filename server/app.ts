import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import portalsRouter from './routes/portals';

export function createExpressApp(): Express {
  const app = express();

  // Trust reverse proxy (Hostinger Nginx, Cloud Run)
  app.set('trust proxy', true);

  // CORS Configuration
  const allowedOrigins = [
    'https://nexora.ashouracademy.com',
    'https://ashouracademy.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
  ];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || origin.endsWith('.run.app') || origin.endsWith('.ashouracademy.com')) {
        return callback(null, true);
      }
      return callback(null, true); // Dev-friendly fallback
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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

  // Backward compatibility alias for `/api/health`
  app.use('/api/health', healthRouter);

  // 404 handler for API routes
  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'ENDPOINT_NOT_FOUND',
      message: 'نقطة النهاية المطلوبة غير موجودة في واجهة برمجة تطبيقات NEXORA v1',
    });
  });

  // Centralized Error Handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
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
