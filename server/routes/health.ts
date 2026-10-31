import { Router, Request, Response } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const dbStats = db.getStats();

  res.status(200).json({
    status: 'ok',
    service: 'nexora-backend',
    version: '1.0.0-phase3.1',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    targetDomain: 'https://nexora.ashouracademy.com',
    hosting: {
      provider: 'Hostinger Business Web Hosting',
      runtime: 'Node.js (Web App)',
      nodeVersion: process.version,
    },
    database: {
      status: dbStats.status,
      driver: dbStats.mode,
      tablesConfigured: dbStats.tables,
      records: dbStats.counts,
    },
    features: {
      jwtAuth: true,
      rbacPortals: true,
      bcryptHash: true,
      rateLimiting: true,
      offlineDemoFallback: true,
    },
  });
});

/**
 * GET /api/v1/health/db-diagnostics
 * Protected administrative diagnostics route.
 * Strictly requires authentication and LEAD (Supervisory) or PRO (Department Head) role.
 * Sanitizes all output to prevent leakage of credentials, connection strings, or raw SQL errors.
 */
router.get('/db-diagnostics', authMiddleware, requireRole(['LEAD', 'PRO']), async (req: AuthRequest, res: Response) => {
  try {
    const rawDiagnostics = await db.getDiagnostics();

    // Sanitize diagnostics: redact passwords in connection strings, tokens, and raw secrets
    const sanitizedDiagnostics = JSON.parse(
      JSON.stringify(rawDiagnostics, (key, value) => {
        if (typeof value === 'string') {
          // Redact credentials in connection strings: postgres://user:pass@host:port/db
          let sanitized = value.replace(
            /(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi,
            '$1[REDACTED_PASSWORD]$3'
          );
          // Redact Bearer tokens
          sanitized = sanitized.replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED_TOKEN]');
          return sanitized;
        }
        if (key.toLowerCase().includes('password') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) {
          return '[REDACTED]';
        }
        return value;
      })
    );

    res.status(200).json({
      success: true,
      service: 'nexora-backend',
      timestamp: new Date().toISOString(),
      requestedBy: {
        userId: req.user?.id,
        role: req.user?.role_code,
      },
      diagnostics: sanitizedDiagnostics,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown diagnostic error';
    res.status(500).json({
      success: false,
      error: 'DIAGNOSTICS_ERROR',
      message: 'تعذر استخراج تشخيصات قاعدة البيانات',
      details: process.env.NODE_ENV !== 'production' ? message : undefined,
    });
  }
});

export default router;
