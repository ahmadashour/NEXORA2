import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding-window rate limiter for sensitive authentication routes
 * Default: 30 requests per 10 minutes per IP address
 */
export function createRateLimiter(options: { maxRequests: number; windowMs: number }) {
  const store = new Map<string, RateLimitRecord>();

  // Cleanup expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.resetAt <= now) {
        store.delete(key);
      }
    }
  }, 60000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : Array.isArray(forwarded) ? forwarded[0] : null) || req.ip || req.socket.remoteAddress || 'unknown-client';
    const now = Date.now();

    const record = store.get(ip);

    if (!record || record.resetAt <= now) {
      store.set(ip, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', options.maxRequests - 1);
      return next();
    }

    if (record.count >= options.maxRequests) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'تم تجاوز الحد الأقصى للمحاولات المتزامنة. يرجى الانتظار والمحاولة لاحقاً لحماية حسابك.',
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }

    record.count += 1;
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', options.maxRequests - record.count);
    next();
  };
}
