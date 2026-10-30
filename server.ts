import { createServer as createViteServer } from 'vite';
import { createExpressApp } from './server/app';
import path from 'path';
import fs from 'fs';
import express from 'express';

import { getJwtSecret } from './server/middleware/auth';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  // Security guard: Validate JWT secret configuration before starting up
  if (isProduction) {
    try {
      getJwtSecret();
      console.log('[NEXORA SECURITY] Production JWT_SECRET validated successfully.');
    } catch (secErr) {
      console.error('[NEXORA SECURITY FATAL]', secErr instanceof Error ? secErr.message : secErr);
      process.exit(1);
    }
  }

  const app = createExpressApp();

  if (!isProduction) {
    // Development mode: Mount Vite middleware to serve React SPA with HMR/transforms
    console.log('[NEXORA] Starting development server with Vite middleware...');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: HOST,
        port: PORT,
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built static files from /dist
    console.log('[NEXORA] Starting production server from dist directory...');
    const distPath = path.resolve(process.cwd(), 'dist');

    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        // Enforce: Never serve SPA index.html for API requests
        if (req.path.startsWith('/api')) {
          res.status(404).json({
            success: false,
            error: 'ENDPOINT_NOT_FOUND',
            message: 'نقطة النهاية المطلوبة غير موجودة في واجهة برمجة تطبيقات NEXORA v1',
          });
          return;
        }
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      console.warn('[NEXORA WARNING] dist directory not found. Please run "npm run build" first.');
    }
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`  NEXORA Platform — Phase 3.1 Backend Foundation`);
    console.log(`  Server running at: http://${HOST}:${PORT}`);
    console.log(`  Target Domain: https://nexora.ashouracademy.com`);
    console.log(`  API Health Endpoint: http://${HOST}:${PORT}/api/v1/health`);
    console.log(`=======================================================`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('[NEXORA] Gracefully shutting down server...');
    server.close(() => {
      console.log('[NEXORA] Server terminated.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('[NEXORA FATAL] Failed to start server:', err);
  process.exit(1);
});
