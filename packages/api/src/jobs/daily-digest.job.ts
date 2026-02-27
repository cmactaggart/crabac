import { db } from '../database/connection.js';
import { renderDigestEmail } from '../lib/newsletter-templates.js';
import { sendEmail } from '../lib/email.js';
import { config } from '../config.js';

/**
 * Process daily digest: aggregate newsletters from the last 24h and send to daily_digest subscribers.
 */
export async function processDailyDigest() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await processDigest('daily_digest', since, 'daily');
}

/**
 * Process weekly digest: aggregate newsletters from the last 7 days.
 */
export async function processWeeklyDigest() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await processDigest('weekly_digest', since, 'weekly');
}

async function processDigest(frequency: string, since: Date, label: 'daily' | 'weekly') {
  console.log(`[${label}-digest] Starting...`);

  // Get all recent published newsletters
  const newsletters = await db('newsletters')
    .where('status', 'published')
    .where('published_at', '>=', since)
    .orderBy('published_at', 'desc')
    .select('id', 'space_id', 'author_id', 'subject', 'summary', 'published_at');

  if (newsletters.length === 0) {
    console.log(`[${label}-digest] No newsletters to send.`);
    return;
  }

  // Build source map: sourceKey -> newsletters[]
  const sourceMap = new Map<string, typeof newsletters>();
  for (const nl of newsletters) {
    const key = nl.space_id ? `space:${nl.space_id}` : `user:${nl.author_id}`;
    if (!sourceMap.has(key)) sourceMap.set(key, []);
    sourceMap.get(key)!.push(nl);
  }

  // Get authenticated digest subscribers
  const authSubs = await db('newsletter_subscriptions')
    .where({ frequency, is_active: true })
    .select('id', 'user_id', 'source_type', 'source_id', 'unsubscribe_token');

  // Get anonymous digest subscribers
  const anonSubs = await db('newsletter_anonymous_subscribers')
    .where({ frequency, is_active: true, email_verified: true })
    .select('id', 'email', 'source_type', 'source_id', 'unsubscribe_token');

  // Get user emails
  const userIds = [...new Set(authSubs.map((s: any) => s.user_id))];
  const users = userIds.length > 0
    ? await db('users').whereIn('id', userIds).select('id', 'email')
    : [];
  const userEmailMap = new Map(users.map((u: any) => [String(u.id), u.email]));

  // Get space info for building URLs
  const spaceIds = [...new Set(newsletters.filter(n => n.space_id).map(n => n.space_id))];
  const spaces = spaceIds.length > 0
    ? await db('spaces').whereIn('id', spaceIds).select('id', 'slug')
    : [];
  const spaceSlugMap = new Map(spaces.map((s: any) => [String(s.id), s.slug]));

  // Get author info for personal newsletter URLs
  const authorIds = [...new Set(newsletters.filter(n => !n.space_id).map(n => n.author_id))];
  const authors = authorIds.length > 0
    ? await db('users').whereIn('id', authorIds).select('id', 'username')
    : [];
  const authorUsernameMap = new Map(authors.map((u: any) => [String(u.id), u.username]));

  let sentCount = 0;

  // Process authenticated subscribers
  for (const sub of authSubs) {
    const key = `${sub.source_type}:${sub.source_id}`;
    const relevantNewsletters = sourceMap.get(key) || [];
    if (relevantNewsletters.length === 0) continue;

    const email = userEmailMap.get(String(sub.user_id));
    if (!email) continue;

    const items = relevantNewsletters.map((nl: any) => ({
      subject: nl.subject,
      summary: nl.summary,
      publishedAt: nl.published_at,
      readUrl: buildReadUrl(nl, spaceSlugMap, authorUsernameMap),
    }));

    const html = renderDigestEmail({
      newsletters: items,
      frequency: label,
      unsubscribeToken: sub.unsubscribe_token,
      appUrl: config.appUrl,
    });

    try {
      await sendEmail(email, `Your ${label} newsletter digest — crab.ac`, html);
      sentCount++;
    } catch (err) {
      console.error(`[${label}-digest] Failed to send to ${email}:`, err);
    }
  }

  // Process anonymous subscribers
  for (const sub of anonSubs) {
    const key = `${sub.source_type}:${sub.source_id}`;
    const relevantNewsletters = sourceMap.get(key) || [];
    if (relevantNewsletters.length === 0) continue;

    const items = relevantNewsletters.map((nl: any) => ({
      subject: nl.subject,
      summary: nl.summary,
      publishedAt: nl.published_at,
      readUrl: buildReadUrl(nl, spaceSlugMap, authorUsernameMap),
    }));

    const html = renderDigestEmail({
      newsletters: items,
      frequency: label,
      unsubscribeToken: sub.unsubscribe_token,
      appUrl: config.appUrl,
    });

    try {
      await sendEmail(sub.email, `Your ${label} newsletter digest — crab.ac`, html);
      sentCount++;
    } catch (err) {
      console.error(`[${label}-digest] Failed to send to ${sub.email}:`, err);
    }
  }

  console.log(`[${label}-digest] Sent ${sentCount} digest emails.`);
}

function buildReadUrl(
  nl: any,
  spaceSlugMap: Map<string, string>,
  authorUsernameMap: Map<string, string>,
): string {
  if (nl.space_id) {
    const slug = spaceSlugMap.get(String(nl.space_id)) || nl.space_id;
    return `${config.appUrl}/newsletter/${slug}/${nl.id}`;
  }
  const username = authorUsernameMap.get(String(nl.author_id)) || nl.author_id;
  return `${config.appUrl}/newsletter/u/${username}/${nl.id}`;
}
