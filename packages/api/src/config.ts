import 'dotenv/config';
import path from 'path';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'crabac',
    password: process.env.DB_PASSWORD || 'crabacpass',
    database: process.env.DB_NAME || 'crabac',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  },

  refreshTokenExpiresDays: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10),

  workerId: parseInt(process.env.WORKER_ID || '1', 10),

  uploadsDir: process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads'),

  smtp: {
    host: process.env.SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'crab.ac <magic-crab@crab.ac>',
  },
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  totpEncryptionKey: process.env.TOTP_ENCRYPTION_KEY || 'change-me-32-byte-key-for-totp!',
  adminEmails: (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean),
} as const;
