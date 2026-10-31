import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * Robust in-memory sliding-window rate limiter.
 * Uses trusted req.ip (evaluated safely by Express with trusted proxy hops)
 * to prevent IP spoofing attacks via manipulated X-Forwarded-For headers.
 */
export function createRateLimiter(options: { maxRequests: number; windowMs: number; keyPrefix?: string }) {
  const store = new Map<string, RateLimitRecord>();
  const prefix = options.keyPrefix ? `${options.keyPrefix}:` : '';

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
    // Strictly rely on Express req.ip (never parse raw untrusted X-Forwarded-For manually)
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown-client';
    const key = `${prefix}${clientIp}`;
    const now = Date.now();

    const record = store.get(key);

    if (!record || record.resetAt <= now) {
      store.set(key, {
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

// Pre-configured route limiters
export const generalAuthLimiter = createRateLimiter({
  maxRequests: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000,
  keyPrefix: 'auth',
});

export const loginLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 5 * 60 * 1000, // 10 attempts per 5 minutes
  keyPrefix: 'login',
});

export const registerLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 5 registrations per 15 minutes
  keyPrefix: 'register',
});

export const passwordLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 5 attempts per 15 minutes
  keyPrefix: 'pwd',
});

export const aiLimiter = createRateLimiter({
  maxRequests: 20,
  windowMs: 60 * 1000, // 20 requests per minute
  keyPrefix: 'ai',
});

export const apiWriteLimiter = createRateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000, // 60 writes per minute
  keyPrefix: 'api-write',
});

export const inquiryLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000, // 10 inquiries per 15 minutes
  keyPrefix: 'inquiry',
});

