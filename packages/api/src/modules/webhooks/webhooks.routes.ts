import { Router, type Request, type Response } from 'express';
import express from 'express';
import { db } from '../../database/connection.js';
import { webhookLimiter } from '../../middleware/rate-limiter.js';
import { processEvent } from '../workflows/workflows.engine.js';

export const webhookRoutes = Router();

const SECRET_REGEX = /^[0-9a-f]{64}$/;

// 64KB body limit for webhook payloads
webhookRoutes.use(express.json({ limit: '64kb' }));

// POST /api/webhooks/:secret/:slug
webhookRoutes.post(
  '/:secret/:slug',
  webhookLimiter,
  async (req: Request, res: Response) => {
    const { secret, slug } = req.params;

    if (!SECRET_REGEX.test(secret)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const settings = await db('space_settings')
      .where({ webhook_secret: secret, webhooks_enabled: true })
      .select('space_id')
      .first();

    if (!settings) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const spaceId = String(settings.space_id);
    const payload = req.body || {};

    // Fire-and-forget — don't block the HTTP response
    processEvent('webhook', spaceId, {
      spaceId,
      webhookSlug: slug,
      webhookMethod: 'POST',
      webhookPayload: payload,
    }).catch((err) => {
      console.error('[Webhook] Error processing webhook event:', err);
    });

    res.json({ ok: true });
  },
);

// GET /api/webhooks/:secret/:slug
webhookRoutes.get(
  '/:secret/:slug',
  webhookLimiter,
  async (req: Request, res: Response) => {
    const { secret, slug } = req.params;

    if (!SECRET_REGEX.test(secret)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const settings = await db('space_settings')
      .where({ webhook_secret: secret, webhooks_enabled: true })
      .select('space_id')
      .first();

    if (!settings) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const spaceId = String(settings.space_id);
    const payload = req.query || {};

    processEvent('webhook', spaceId, {
      spaceId,
      webhookSlug: slug,
      webhookMethod: 'GET',
      webhookPayload: payload as Record<string, any>,
    }).catch((err) => {
      console.error('[Webhook] Error processing webhook event:', err);
    });

    res.json({ ok: true });
  },
);
