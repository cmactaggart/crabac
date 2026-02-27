import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { generateToken } from '../../lib/newsletter-tokens.js';
import { renderNewsletterEmail } from '../../lib/newsletter-templates.js';
import { sendEmail } from '../../lib/email.js';
import { config } from '../../config.js';

/**
 * Enqueue newsletter sends for all active subscribers when a newsletter is published.
 */
export async function enqueueNewsletterSends(newsletterId: string) {
  const newsletter = await db('newsletters').where('id', newsletterId).first();
  if (!newsletter || newsletter.status !== 'published') return;

  const spaceId = newsletter.space_id;
  const sourceType = spaceId ? 'space' : 'user';
  const sourceId = spaceId || newsletter.author_id;

  // Check tracking setting
  let trackingEnabled = true;
  if (spaceId) {
    const settings = await db('space_settings').where('space_id', spaceId).first();
    trackingEnabled = settings ? !!settings.newsletter_tracking_enabled : true;
  }

  // Add to digest queue for digest subscribers
  const digestQueueId = snowflake.generate();
  await db('newsletter_digest_queue').insert({
    id: digestQueueId,
    newsletter_id: newsletterId,
    source_type: sourceType,
    source_id: sourceId,
    published_at: newsletter.published_at || db.fn.now(),
    processed: false,
  });

  // Get immediate subscribers (authenticated)
  const authSubs = await db('newsletter_subscriptions')
    .where({ source_type: sourceType, source_id: sourceId, is_active: true, frequency: 'immediate' })
    .select('id', 'user_id', 'unsubscribe_token');

  // Get user emails
  const userIds = authSubs.map((s: any) => s.user_id);
  const users = userIds.length > 0
    ? await db('users').whereIn('id', userIds).select('id', 'email')
    : [];
  const userEmailMap = new Map(users.map((u: any) => [String(u.id), u.email]));

  // Get immediate anonymous subscribers
  const anonSubs = await db('newsletter_anonymous_subscribers')
    .where({ source_type: sourceType, source_id: sourceId, is_active: true, email_verified: true, frequency: 'immediate' })
    .select('id', 'email', 'unsubscribe_token');

  // Create send records and send immediately
  const author = await db('users').where('id', newsletter.author_id).first();
  const space = spaceId ? await db('spaces').where('id', spaceId).first() : null;
  const senderName = space ? space.name : (author?.display_name || 'crab.ac');

  // Parse blocks
  let blocks: any[] = [];
  try { blocks = typeof newsletter.blocks === 'string' ? JSON.parse(newsletter.blocks) : newsletter.blocks; } catch { blocks = []; }

  for (const sub of authSubs) {
    const email = userEmailMap.get(String(sub.user_id));
    if (!email) continue;

    const trackingToken = generateToken();
    const sendId = snowflake.generate();

    await db('newsletter_sends').insert({
      id: sendId,
      newsletter_id: newsletterId,
      recipient_type: 'user',
      recipient_id: sub.id,
      email,
      status: 'queued',
      tracking_token: trackingToken,
    });

    try {
      const html = renderNewsletterEmail({
        subject: newsletter.subject,
        summary: newsletter.summary,
        headerImageUrl: newsletter.header_image_url,
        blocks,
        senderName,
        trackingToken: trackingEnabled ? trackingToken : null,
        unsubscribeToken: sub.unsubscribe_token,
        appUrl: config.appUrl,
      });

      await sendEmail(email, `${newsletter.subject} — ${senderName}`, html);
      await db('newsletter_sends').where('id', sendId).update({ status: 'sent', sent_at: db.fn.now() });
    } catch (err) {
      console.error(`Failed to send newsletter to ${email}:`, err);
    }
  }

  for (const sub of anonSubs) {
    const trackingToken = generateToken();
    const sendId = snowflake.generate();

    await db('newsletter_sends').insert({
      id: sendId,
      newsletter_id: newsletterId,
      recipient_type: 'anonymous',
      recipient_id: sub.id,
      email: sub.email,
      status: 'queued',
      tracking_token: trackingToken,
    });

    try {
      const html = renderNewsletterEmail({
        subject: newsletter.subject,
        summary: newsletter.summary,
        headerImageUrl: newsletter.header_image_url,
        blocks,
        senderName,
        trackingToken: trackingEnabled ? trackingToken : null,
        unsubscribeToken: sub.unsubscribe_token,
        appUrl: config.appUrl,
      });

      await sendEmail(sub.email, `${newsletter.subject} — ${senderName}`, html);
      await db('newsletter_sends').where('id', sendId).update({ status: 'sent', sent_at: db.fn.now() });
    } catch (err) {
      console.error(`Failed to send newsletter to ${sub.email}:`, err);
    }
  }
}
