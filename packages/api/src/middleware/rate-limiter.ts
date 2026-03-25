import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  // Use CF-Connecting-IP header (set by Cloudflare) so users behind the tunnel get distinct buckets
  keyGenerator: (req: Request) => req.headers['cf-connecting-ip'] as string || req.ip || '0.0.0.0',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many auth attempts' } },
});

export const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many auth attempts' } },
});

export const publicBoardLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

export const publicBoardPostLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many posts' } },
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.params.secret || req.ip || '0.0.0.0',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many webhook requests' } },
});

// Public meeting join — stricter to prevent password brute-force
export const publicMeetingJoinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.headers['cf-connecting-ip'] as string || req.ip || '0.0.0.0',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many join attempts' } },
});

// Email verification requests — prevent email spam
export const meetingEmailVerifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.headers['cf-connecting-ip'] as string || req.ip || '0.0.0.0',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many verification requests' } },
});

export const mobileUpdateCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.headers['cf-connecting-ip'] as string || req.ip || '0.0.0.0',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many update checks' } },
});
