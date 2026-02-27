import crypto from 'crypto';
import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';

// 1x1 transparent GIF
export const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export async function recordOpen(trackingToken: string) {
  const send = await db('newsletter_sends')
    .where('tracking_token', trackingToken)
    .first();

  if (!send) return;

  const updates: Record<string, any> = {
    open_count: db.raw('open_count + 1'),
  };

  if (!send.opened_at) {
    updates.opened_at = db.fn.now();
    updates.status = 'opened';
  }

  await db('newsletter_sends')
    .where('id', send.id)
    .update(updates);
}

export async function recordClick(
  trackingToken: string,
  originalUrl: string,
  userAgent: string | null,
  ipAddress: string | null,
) {
  const send = await db('newsletter_sends')
    .where('tracking_token', trackingToken)
    .first();

  if (!send) return originalUrl;

  // Record the click
  const id = snowflake.generate();
  await db('newsletter_link_clicks').insert({
    id,
    send_id: send.id,
    original_url: originalUrl,
    user_agent: userAgent?.slice(0, 500) || null,
    ip_hash: ipAddress ? crypto.createHash('sha256').update(ipAddress).digest('hex').slice(0, 16) : null,
  });

  // Update click count on the send
  await db('newsletter_sends')
    .where('id', send.id)
    .update({ click_count: db.raw('click_count + 1') });

  return originalUrl;
}

export async function getNewsletterStats(newsletterId: string) {
  const [stats] = await db('newsletter_sends')
    .where('newsletter_id', newsletterId)
    .select(
      db.raw('COUNT(*) as total_sent'),
      db.raw("SUM(CASE WHEN status IN ('delivered', 'opened') THEN 1 ELSE 0 END) as total_delivered"),
      db.raw("SUM(CASE WHEN status = 'opened' OR open_count > 0 THEN 1 ELSE 0 END) as total_opened"),
      db.raw("SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as unique_opens"),
      db.raw('SUM(click_count) as total_clicks'),
      db.raw("SUM(CASE WHEN click_count > 0 THEN 1 ELSE 0 END) as unique_clicks"),
    );

  const newsletter = await db('newsletters')
    .where('id', newsletterId)
    .select('subject', 'published_at')
    .first();

  return {
    newsletterId,
    subject: newsletter?.subject || '',
    publishedAt: newsletter?.published_at || null,
    totalSent: Number(stats?.total_sent || 0),
    totalDelivered: Number(stats?.total_delivered || 0),
    totalOpened: Number(stats?.total_opened || 0),
    uniqueOpens: Number(stats?.unique_opens || 0),
    totalClicks: Number(stats?.total_clicks || 0),
    uniqueClicks: Number(stats?.unique_clicks || 0),
  };
}

export async function getNewsletterAnalyticsList(spaceId: string) {
  const newsletters = await db('newsletters')
    .where('space_id', spaceId)
    .where('status', 'published')
    .orderBy('published_at', 'desc')
    .limit(50)
    .select('id', 'subject', 'published_at');

  const results = [];
  for (const nl of newsletters) {
    const stats = await getNewsletterStats(String(nl.id));
    results.push(stats);
  }

  return results;
}
