import { Router, type Request, type Response, type NextFunction } from 'express';
import { optionalAuthenticate } from '../boards/boards.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';
import { db } from '../../database/connection.js';
import { NotFoundError } from '../../lib/errors.js';
import { publicMeetingJoinLimiter, meetingEmailVerifyLimiter } from '../../middleware/rate-limiter.js';
import * as publicMeetingService from './public-meeting.service.js';

export const publicMeetingRoutes = Router();

publicMeetingRoutes.use(optionalAuthenticate);

// ─── Resolve space by slug for meeting routes ───

async function resolveSpaceAndEvent(req: Request) {
  const { spaceSlug, eventId } = req.params;

  const space = await db('spaces').where('slug', spaceSlug).first();
  if (!space) throw new NotFoundError('Space');

  const settings = await db('space_settings').where('space_id', space.id).first();
  if (!settings?.allow_public_voice) throw new NotFoundError('Public meeting');

  const event = await db('calendar_events').where('id', eventId).first();
  if (!event) throw new NotFoundError('Calendar event');
  if (String(event.space_id) !== String(space.id)) throw new NotFoundError('Calendar event');
  if (!event.meeting_room_enabled || !event.meeting_public_access) throw new NotFoundError('Public meeting');

  return { space, settings, event };
}

// ─── Get public meeting info (pre-join screen) ───

publicMeetingRoutes.get(
  '/calendar/:spaceSlug/events/:eventId/meeting',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await resolveSpaceAndEvent(req);
      const info = await publicMeetingService.getPublicMeetingInfo(req.params.eventId);
      res.json(info);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Join public meeting room ───

publicMeetingRoutes.post(
  '/calendar/:spaceSlug/events/:eventId/meeting/join',
  publicMeetingJoinLimiter,
  validate(validation.publicMeetingJoinSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await resolveSpaceAndEvent(req);
      const result = await publicMeetingService.joinPublicMeetingRoom(req.params.eventId, {
        displayName: req.body.displayName,
        password: req.body.password,
        sessionToken: req.body.sessionToken,
        inviteToken: req.body.inviteToken,
        emailVerificationToken: req.body.emailVerificationToken,
        userId: req.user?.userId,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Leave public meeting room ───

publicMeetingRoutes.post(
  '/calendar/:spaceSlug/events/:eventId/meeting/leave',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionToken } = req.body;
      if (!sessionToken) return res.status(400).json({ error: { message: 'sessionToken required' } });
      await publicMeetingService.leavePublicMeetingRoom(req.params.eventId, sessionToken);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// ─── Request email verification ───

publicMeetingRoutes.post(
  '/calendar/:spaceSlug/events/:eventId/meeting/verify-email',
  meetingEmailVerifyLimiter,
  validate(validation.requestMeetingEmailVerificationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await resolveSpaceAndEvent(req);
      const result = await publicMeetingService.requestEmailVerification(
        req.params.eventId,
        req.body.email,
        req.body.displayName,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Verify email token (callback from email link) ───

publicMeetingRoutes.get(
  '/meeting/verify/:token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await publicMeetingService.verifyMeetingEmail(req.params.token);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ═══════════════════════════════════════════════
// Public Voice Channel Routes
// ═══════════════════════════════════════════════

async function resolveSpaceAndVoiceChannel(req: Request) {
  const { spaceSlug, channelName } = req.params;

  const space = await db('spaces').where('slug', spaceSlug).first();
  if (!space) throw new NotFoundError('Space');

  const settings = await db('space_settings').where('space_id', space.id).first();
  if (!settings?.allow_public_voice) throw new NotFoundError('Public voice channel');

  const channel = await db('channels')
    .where({ space_id: space.id, name: channelName, type: 'voice' })
    .first();
  if (!channel) throw new NotFoundError('Voice channel');
  if (!channel.public_voice_access) throw new NotFoundError('Public voice channel');

  return { space, settings, channel };
}

// ─── Get public voice channel info ───

publicMeetingRoutes.get(
  '/:spaceSlug/voice/:channelName/meeting',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channel } = await resolveSpaceAndVoiceChannel(req);
      const info = await publicMeetingService.getPublicVoiceChannelInfo(String(channel.id));
      res.json(info);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Join public voice channel ───

publicMeetingRoutes.post(
  '/:spaceSlug/voice/:channelName/meeting/join',
  publicMeetingJoinLimiter,
  validate(validation.publicMeetingJoinSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channel } = await resolveSpaceAndVoiceChannel(req);
      const result = await publicMeetingService.joinPublicVoiceChannel(String(channel.id), {
        displayName: req.body.displayName,
        password: req.body.password,
        sessionToken: req.body.sessionToken,
        inviteToken: req.body.inviteToken,
        emailVerificationToken: req.body.emailVerificationToken,
        userId: req.user?.userId,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Leave public voice channel ───

publicMeetingRoutes.post(
  '/:spaceSlug/voice/:channelName/meeting/leave',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channel } = await resolveSpaceAndVoiceChannel(req);
      const { sessionToken } = req.body;
      if (!sessionToken) return res.status(400).json({ error: { message: 'sessionToken required' } });
      await publicMeetingService.leavePublicVoiceChannel(String(channel.id), sessionToken);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// ─── Request email verification for voice channel ───

publicMeetingRoutes.post(
  '/:spaceSlug/voice/:channelName/meeting/verify-email',
  meetingEmailVerifyLimiter,
  validate(validation.requestMeetingEmailVerificationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channel } = await resolveSpaceAndVoiceChannel(req);
      const result = await publicMeetingService.requestVoiceChannelEmailVerification(
        String(channel.id),
        req.body.email,
        req.body.displayName,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
