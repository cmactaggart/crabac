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
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
  },
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  totpEncryptionKey: process.env.TOTP_ENCRYPTION_KEY || 'change-me-32-byte-key-for-totp!',
  adminEmails: (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean),

  plugins: (process.env.PLUGINS || '').split(',').map(p => p.trim()).filter(Boolean),

  newsletter: {
    sesRateLimit: parseInt(process.env.NEWSLETTER_SES_RATE_LIMIT || '14', 10),
    dailyDigestHour: parseInt(process.env.NEWSLETTER_DAILY_DIGEST_HOUR || '8', 10),
    weeklyDigestDay: parseInt(process.env.NEWSLETTER_WEEKLY_DIGEST_DAY || '1', 10), // Monday
    eventHorizonDays: parseInt(process.env.NEWSLETTER_EVENT_HORIZON_DAYS || '14', 10),
  },

  typesense: {
    host: process.env.TYPESENSE_HOST || 'localhost',
    port: parseInt(process.env.TYPESENSE_PORT || '8108', 10),
    protocol: process.env.TYPESENSE_PROTOCOL || 'http',
    apiKey: process.env.TYPESENSE_API_KEY || '',
  },

  apns: {
    keyPath: process.env.APNS_KEY_PATH || '',
    keyId: process.env.APNS_KEY_ID || '',
    teamId: process.env.APNS_TEAM_ID || '',
    bundleId: process.env.APNS_BUNDLE_ID || 'ac.crab.app',
    production: process.env.APNS_PRODUCTION === 'true',
  },
} as const;
