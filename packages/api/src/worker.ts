import 'dotenv/config';
import { config } from './config.js';
import { redis } from './lib/redis.js';
import { processDailyDigest, processWeeklyDigest } from './jobs/daily-digest.job.js';

/**
 * Newsletter worker process.
 * Runs digest cron jobs on schedule.
 */

const DAILY_DIGEST_HOUR = config.newsletter.dailyDigestHour; // UTC
const WEEKLY_DIGEST_DAY = config.newsletter.weeklyDigestDay; // 1 = Monday

let running = true;
let lastDailyRun: string | null = null;
let lastWeeklyRun: string | null = null;

async function checkAndRunDigests() {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const weekKey = `${dateKey}-w`;
  const hour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday

  // Daily digest: run once per day at the configured hour
  if (hour >= DAILY_DIGEST_HOUR && lastDailyRun !== dateKey) {
    lastDailyRun = dateKey;
    console.log('[worker] Running daily digest...');
    try {
      await processDailyDigest();
    } catch (err) {
      console.error('[worker] Daily digest failed:', err);
    }
  }

  // Weekly digest: run once per week on the configured day
  if (hour >= DAILY_DIGEST_HOUR && dayOfWeek === WEEKLY_DIGEST_DAY && lastWeeklyRun !== weekKey) {
    lastWeeklyRun = weekKey;
    console.log('[worker] Running weekly digest...');
    try {
      await processWeeklyDigest();
    } catch (err) {
      console.error('[worker] Weekly digest failed:', err);
    }
  }
}

async function start() {
  console.log(`[worker] Newsletter worker starting (workerId=${config.workerId})...`);

  try {
    await redis.connect();
    console.log('[worker] Redis connected');
  } catch (err) {
    console.error('[worker] Redis connection failed:', err);
  }

  // Check every 5 minutes
  const interval = setInterval(async () => {
    if (!running) return;
    try {
      await checkAndRunDigests();
    } catch (err) {
      console.error('[worker] Check failed:', err);
    }
  }, 5 * 60 * 1000);

  // Run initial check
  await checkAndRunDigests();

  // Graceful shutdown
  const shutdown = () => {
    console.log('[worker] Shutting down...');
    running = false;
    clearInterval(interval);
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log('[worker] Newsletter worker running. Daily digest at UTC ' + DAILY_DIGEST_HOUR + ':00');
}

start();
