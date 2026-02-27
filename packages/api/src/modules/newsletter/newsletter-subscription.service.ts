import crypto from 'crypto';
import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError } from '../../lib/errors.js';
import { generateToken, hashToken } from '../../lib/newsletter-tokens.js';
import { sendEmail } from '../../lib/email.js';
import { config } from '../../config.js';

// ─── Authenticated Subscriptions ───

export async function subscribe(
  userId: string,
  data: { sourceType: 'space' | 'user'; sourceId: string; frequency?: string },
) {
  const existing = await db('newsletter_subscriptions')
    .where({ user_id: userId, source_type: data.sourceType, source_id: data.sourceId })
    .first();

  if (existing) {
    await db('newsletter_subscriptions')
      .where('id', existing.id)
      .update({
        is_active: true,
        frequency: data.frequency || 'immediate',
        updated_at: db.fn.now(),
      });
    return getSubscription(String(existing.id));
  }

  const id = snowflake.generate();
  const unsubToken = generateToken();

  await db('newsletter_subscriptions').insert({
    id,
    user_id: userId,
    source_type: data.sourceType,
    source_id: data.sourceId,
    frequency: data.frequency || 'immediate',
    is_active: true,
    unsubscribe_token: unsubToken,
  });

  return getSubscription(String(id));
}

export async function updateSubscription(
  subscriptionId: string,
  userId: string,
  data: { frequency?: string; isActive?: boolean },
) {
  const sub = await db('newsletter_subscriptions')
    .where({ id: subscriptionId, user_id: userId })
    .first();
  if (!sub) throw new NotFoundError('Subscription');

  const updates: Record<string, any> = {};
  if (data.frequency !== undefined) updates.frequency = data.frequency;
  if (data.isActive !== undefined) updates.is_active = data.isActive;
  updates.updated_at = db.fn.now();

  await db('newsletter_subscriptions').where('id', subscriptionId).update(updates);
  return getSubscription(subscriptionId);
}

export async function unsubscribe(subscriptionId: string, userId: string) {
  const updated = await db('newsletter_subscriptions')
    .where({ id: subscriptionId, user_id: userId })
    .update({ is_active: false, updated_at: db.fn.now() });
  if (!updated) throw new NotFoundError('Subscription');
}

export async function listUserSubscriptions(userId: string) {
  const rows = await db('newsletter_subscriptions')
    .where('user_id', userId)
    .orderBy('created_at', 'desc');
  return rows.map(formatSubscription);
}

export async function getUserSubscription(
  userId: string,
  sourceType: string,
  sourceId: string,
) {
  const row = await db('newsletter_subscriptions')
    .where({ user_id: userId, source_type: sourceType, source_id: sourceId })
    .first();
  return row ? formatSubscription(row) : null;
}

// ─── Anonymous Subscriptions ───

export async function anonymousSubscribe(
  data: { email: string; sourceType: 'space' | 'user'; sourceId: string; frequency?: string },
) {
  const existing = await db('newsletter_anonymous_subscribers')
    .where({ email: data.email, source_type: data.sourceType, source_id: data.sourceId })
    .first();

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(verificationToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  if (existing) {
    await db('newsletter_anonymous_subscribers')
      .where('id', existing.id)
      .update({
        frequency: data.frequency || 'immediate',
        verification_token_hash: tokenHash,
        verification_expires_at: expiresAt,
        updated_at: db.fn.now(),
      });
  } else {
    const id = snowflake.generate();
    const unsubToken = generateToken();

    await db('newsletter_anonymous_subscribers').insert({
      id,
      email: data.email,
      source_type: data.sourceType,
      source_id: data.sourceId,
      frequency: data.frequency || 'immediate',
      is_active: false,
      email_verified: false,
      verification_token_hash: tokenHash,
      verification_expires_at: expiresAt,
      unsubscribe_token: unsubToken,
    });
  }

  // Send verification email
  const verifyLink = `${config.appUrl}/newsletter/verify/${verificationToken}`;
  await sendEmail(data.email, 'Verify your newsletter subscription — crab.ac', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2>Confirm your subscription</h2>
      <p>Click the button below to verify your email and start receiving newsletters.</p>
      <a href="${verifyLink}" style="display:inline-block;background:#5865f2;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Verify Subscription</a>
      <p style="margin-top:16px;color:#888;font-size:13px;">Or copy this link: ${verifyLink}</p>
      <p style="color:#888;font-size:13px;">This link expires in 24 hours.</p>
    </div>
  `);

  return { message: 'Verification email sent' };
}

export async function verifyAnonymousSubscription(token: string) {
  const tokenHash = hashToken(token);
  const sub = await db('newsletter_anonymous_subscribers')
    .where('verification_token_hash', tokenHash)
    .where('verification_expires_at', '>', new Date())
    .first();

  if (!sub) throw new NotFoundError('Invalid or expired verification token');

  await db('newsletter_anonymous_subscribers')
    .where('id', sub.id)
    .update({
      email_verified: true,
      is_active: true,
      verification_token_hash: null,
      verification_expires_at: null,
      updated_at: db.fn.now(),
    });

  return { message: 'Subscription verified' };
}

// ─── Token-based operations (for email unsubscribe links) ───

export async function unsubscribeByToken(token: string) {
  // Try authenticated subscriptions first
  let updated = await db('newsletter_subscriptions')
    .where('unsubscribe_token', token)
    .update({ is_active: false, updated_at: db.fn.now() });

  if (!updated) {
    updated = await db('newsletter_anonymous_subscribers')
      .where('unsubscribe_token', token)
      .update({ is_active: false, updated_at: db.fn.now() });
  }

  if (!updated) throw new NotFoundError('Subscription');
  return { message: 'Unsubscribed successfully' };
}

export async function getPreferencesByToken(token: string) {
  let sub = await db('newsletter_subscriptions')
    .where('unsubscribe_token', token)
    .first();

  if (sub) {
    return { type: 'authenticated' as const, ...formatSubscription(sub) };
  }

  sub = await db('newsletter_anonymous_subscribers')
    .where('unsubscribe_token', token)
    .first();

  if (sub) {
    return {
      type: 'anonymous' as const,
      id: String(sub.id),
      email: sub.email,
      sourceType: sub.source_type,
      sourceId: String(sub.source_id),
      frequency: sub.frequency,
      isActive: !!sub.is_active,
    };
  }

  throw new NotFoundError('Subscription');
}

export async function updatePreferencesByToken(
  token: string,
  data: { frequency?: string; isActive?: boolean },
) {
  const updates: Record<string, any> = {};
  if (data.frequency !== undefined) updates.frequency = data.frequency;
  if (data.isActive !== undefined) updates.is_active = data.isActive;
  updates.updated_at = db.fn.now();

  let updated = await db('newsletter_subscriptions')
    .where('unsubscribe_token', token)
    .update(updates);

  if (!updated) {
    updated = await db('newsletter_anonymous_subscribers')
      .where('unsubscribe_token', token)
      .update(updates);
  }

  if (!updated) throw new NotFoundError('Subscription');
  return getPreferencesByToken(token);
}

// ─── Admin functions ───

export async function getSubscriberCounts(sourceType: string, sourceId: string) {
  const [authCount] = await db('newsletter_subscriptions')
    .where({ source_type: sourceType, source_id: sourceId, is_active: true })
    .count('* as count');
  const [anonCount] = await db('newsletter_anonymous_subscribers')
    .where({ source_type: sourceType, source_id: sourceId, is_active: true, email_verified: true })
    .count('* as count');

  return {
    authenticated: Number(authCount.count),
    anonymous: Number(anonCount.count),
    total: Number(authCount.count) + Number(anonCount.count),
  };
}

// ─── Helpers ───

async function getSubscription(id: string) {
  const row = await db('newsletter_subscriptions').where('id', id).first();
  if (!row) throw new NotFoundError('Subscription');
  return formatSubscription(row);
}

function formatSubscription(row: any) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sourceType: row.source_type,
    sourceId: String(row.source_id),
    frequency: row.frequency,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
