import apn from '@parse/node-apn';
import admin from 'firebase-admin';
import { config } from '../../config.js';
import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';

let apnProvider: apn.Provider | null = null;
let fcmInitialized = false;

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

export function initFcmProvider() {
  if (!config.fcm.serviceAccountPath) {
    console.log('[PUSH] FCM not configured, Android push notifications disabled');
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(config.fcm.serviceAccountPath),
    });
    fcmInitialized = true;
    console.log('[PUSH] FCM provider initialized');
  } catch (err) {
    console.error('[PUSH] Failed to initialize FCM:', err);
  }
}

export async function registerDeviceToken(userId: string, token: string, platform: string, appVersion?: string, tokenType: string = 'standard') {
  // Upsert: if token exists, update user_id; otherwise insert
  const existing = await db('device_tokens').where('token', token).first();
  if (existing) {
    await db('device_tokens').where('token', token).update({
      user_id: userId,
      platform,
      app_version: appVersion || null,
      token_type: tokenType,
      updated_at: db.fn.now(),
    });
  } else {
    await db('device_tokens').insert({
      id: snowflake.generate(),
      user_id: userId,
      token,
      platform,
      app_version: appVersion || null,
      token_type: tokenType,
    });
  }
}

export async function unregisterDeviceToken(token: string) {
  await db('device_tokens').where('token', token).delete();
}

export async function sendPushNotification(userId: string, title: string, body: string, data?: Record<string, string>) {
  const hasIos = !!apnProvider;
  const hasAndroid = fcmInitialized;

  if (!hasIos && !hasAndroid) return;

  const allTokens = await db('device_tokens')
    .where('user_id', userId)
    .whereIn('platform', [
      ...(hasIos ? ['ios'] : []),
      ...(hasAndroid ? ['android'] : []),
    ])
    .select('token', 'platform');

  if (allTokens.length === 0) return;

  const iosTokens = allTokens.filter((t) => t.platform === 'ios');
  const androidTokens = allTokens.filter((t) => t.platform === 'android');

  // Send iOS push notifications
  if (apnProvider && iosTokens.length > 0) {
    const notification = new apn.Notification();
    notification.alert = { title, body };
    notification.sound = 'default';
    notification.badge = 1;
    notification.topic = config.apns.bundleId;
    notification.mutableContent = true;
    if (data) {
      notification.payload = data;
    }

    const result = await apnProvider.send(notification, iosTokens.map((t) => t.token));

    // Clean up invalid tokens
    for (const failure of result.failed) {
      if (String(failure.status) === '410' || failure.response?.reason === 'Unregistered') {
        await db('device_tokens').where('token', failure.device).delete();
      }
    }
  }

  // Send Android push notifications (high priority for calls)
  if (fcmInitialized && androidTokens.length > 0) {
    const messages: admin.messaging.Message[] = androidTokens.map((t) => ({
      token: t.token,
      notification: { title, body },
      data: data || undefined,
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
    }));

    const result = await admin.messaging().sendEach(messages);

    // Clean up invalid tokens
    for (let i = 0; i < result.responses.length; i++) {
      const response = result.responses[i];
      if (!response.success && response.error) {
        const code = response.error.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          await db('device_tokens').where('token', androidTokens[i].token).delete();
        }
      }
    }
  }
}

/**
 * Send a VoIP push notification to iOS devices for incoming calls.
 * Uses PushKit which wakes the app and triggers CallKit for the native call UI.
 * Falls back to a regular high-priority push for Android (FCM handles this natively).
 */
export async function sendVoipPush(
  userId: string,
  data: { callId: string; conversationId: string; callerName: string; callerAvatarUrl?: string | null },
) {
  const hasIos = !!apnProvider;
  const hasAndroid = fcmInitialized;

  if (!hasIos && !hasAndroid) return;

  const allTokens = await db('device_tokens')
    .where('user_id', userId)
    .select('token', 'platform', 'token_type');

  if (allTokens.length === 0) return;

  // iOS: prefer VoIP push via PushKit tokens, fall back to regular APNs
  const iosVoipTokens = allTokens.filter((t) => t.platform === 'ios' && t.token_type === 'voip');
  const iosStandardTokens = allTokens.filter((t) => t.platform === 'ios' && t.token_type === 'standard');

  if (apnProvider && iosVoipTokens.length > 0) {
    // Send VoIP push — triggers CallKit
    const notification = new apn.Notification();
    notification.pushType = 'voip';
    notification.topic = `${config.apns.bundleId}.voip`;
    notification.priority = 10;
    notification.expiry = Math.floor(Date.now() / 1000) + 60;
    notification.payload = {
      callId: data.callId,
      conversationId: data.conversationId,
      callerName: data.callerName,
      callerAvatarUrl: data.callerAvatarUrl || null,
    };

    const result = await apnProvider.send(notification, iosVoipTokens.map((t) => t.token));

    for (const failure of result.failed) {
      if (String(failure.status) === '410' || failure.response?.reason === 'Unregistered') {
        await db('device_tokens').where('token', failure.device).delete();
      }
    }
  } else if (apnProvider && iosStandardTokens.length > 0) {
    // Fallback: regular APNs push for devices that haven't registered a VoIP token yet
    const notification = new apn.Notification();
    notification.alert = { title: data.callerName, body: 'Incoming call' };
    notification.sound = 'default';
    notification.badge = 1;
    notification.topic = config.apns.bundleId;
    notification.mutableContent = true;
    notification.payload = {
      type: 'call_ringing',
      callId: data.callId,
      conversationId: data.conversationId,
    };

    const result = await apnProvider.send(notification, iosStandardTokens.map((t) => t.token));

    for (const failure of result.failed) {
      if (String(failure.status) === '410' || failure.response?.reason === 'Unregistered') {
        await db('device_tokens').where('token', failure.device).delete();
      }
    }
  }

  // Android: send high-priority data-only FCM message (triggers heads-up / full-screen intent)
  const androidTokens = allTokens.filter((t) => t.platform === 'android');
  if (fcmInitialized && androidTokens.length > 0) {
    const messages: admin.messaging.Message[] = androidTokens.map((t) => ({
      token: t.token,
      data: {
        type: 'call_ringing',
        callId: data.callId,
        conversationId: data.conversationId,
        callerName: data.callerName,
        callerAvatarUrl: data.callerAvatarUrl || '',
      },
      android: {
        priority: 'high' as const,
        ttl: 60_000, // 60s — matches ringing timeout
      },
    }));

    const result = await admin.messaging().sendEach(messages);

    for (let i = 0; i < result.responses.length; i++) {
      const response = result.responses[i];
      if (!response.success && response.error) {
        const code = response.error.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          await db('device_tokens').where('token', androidTokens[i].token).delete();
        }
      }
    }
  }
}
