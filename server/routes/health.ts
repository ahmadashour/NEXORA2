import { Router, Request, Response } from 'express';
import { db } from '../db';

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

export default router;
