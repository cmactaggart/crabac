import apn from '@parse/node-apn';
import { config } from '../../config.js';
import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';

let apnProvider: apn.Provider | null = null;

export function initApnProvider() {
  if (!config.apns.keyPath || !config.apns.keyId) {
    console.log('[PUSH] APNs not configured, push notifications disabled');
    return;
  }

  apnProvider = new apn.Provider({
    token: {
      key: config.apns.keyPath,
      keyId: config.apns.keyId,
      teamId: config.apns.teamId,
    },
    production: config.apns.production,
  });
  console.log('[PUSH] APNs provider initialized');
}

export async function registerDeviceToken(userId: string, token: string, platform: string, appVersion?: string) {
  // Upsert: if token exists, update user_id; otherwise insert
  const existing = await db('device_tokens').where('token', token).first();
  if (existing) {
    await db('device_tokens').where('token', token).update({
      user_id: userId,
      platform,
      app_version: appVersion || null,
      updated_at: db.fn.now(),
    });
  } else {
    await db('device_tokens').insert({
      id: snowflake.generate(),
      user_id: userId,
      token,
      platform,
      app_version: appVersion || null,
    });
  }
}

export async function unregisterDeviceToken(token: string) {
  await db('device_tokens').where('token', token).delete();
}

export async function sendPushNotification(userId: string, title: string, body: string, data?: Record<string, string>) {
  if (!apnProvider) return;

  const tokens = await db('device_tokens')
    .where('user_id', userId)
    .where('platform', 'ios')
    .select('token');

  if (tokens.length === 0) return;

  const notification = new apn.Notification();
  notification.alert = { title, body };
  notification.sound = 'default';
  notification.badge = 1;
  notification.topic = config.apns.bundleId;
  notification.mutableContent = true;
  if (data) {
    notification.payload = data;
  }

  const result = await apnProvider.send(notification, tokens.map((t) => t.token));

  // Clean up invalid tokens
  for (const failure of result.failed) {
    if (failure.status === '410' || failure.response?.reason === 'Unregistered') {
      await db('device_tokens').where('token', failure.device).delete();
    }
  }
}
