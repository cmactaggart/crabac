import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validation } from '@crabac/shared';
import * as callService from './call.service.js';

export const callRoutes = Router();
callRoutes.use(authenticate);

// Initiate a call in a DM / group DM conversation
callRoutes.post('/conversations/:conversationId/call', async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user!.userId;
    const call = await callService.initiateCall(userId, conversationId);
    res.status(201).json(call);
  } catch (err) {
    next(err);
  }
});

// Get active call for a conversation
callRoutes.get('/conversations/:conversationId/call', async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const call = await callService.getActiveCallForConversation(conversationId);
    res.json({ call });
  } catch (err) {
    next(err);
  }
});

// Respond to a call (accept / decline)
callRoutes.post('/:callId/respond', async (req, res, next) => {
  try {
    const { callId } = req.params;
    const userId = req.user!.userId;
    const { action } = validation.respondToCallSchema.parse(req.body);
    const call = await callService.respondToCall(userId, callId, action);
    res.json(call);
  } catch (err) {
    next(err);
  }
});

// Leave a call
callRoutes.post('/:callId/leave', async (req, res, next) => {
  try {
    const { callId } = req.params;
    const userId = req.user!.userId;
    await callService.leaveCall(userId, callId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Get a call's current state
callRoutes.get('/:callId', async (req, res, next) => {
  try {
    const { callId } = req.params;
    const call = await callService.getCall(callId);
    res.json(call);
  } catch (err) {
    next(err);
  }
});

// Join an existing call (rejoin after leaving or on refresh)
callRoutes.post('/:callId/join', async (req, res, next) => {
  try {
    const { callId } = req.params;
    const userId = req.user!.userId;
    const call = await callService.joinExistingCall(userId, callId);
    res.json(call);
  } catch (err) {
    next(err);
  }
});

// End a call (force)
callRoutes.post('/:callId/end', async (req, res, next) => {
  try {
    const { callId } = req.params;
    const userId = req.user!.userId;
    // Verify the user is a participant
    const call = await callService.getCall(callId);
    if (!call) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Call not found' } });
    const isParticipant = call.participants.some((p) => p.userId === userId);
    if (!isParticipant) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not a participant' } });
    await callService.leaveCall(userId, callId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Get a fresh token for an existing call (reconnect)
callRoutes.post('/:callId/token', async (req, res, next) => {
  try {
    const { callId } = req.params;
    const userId = req.user!.userId;
    const token = await callService.getCallToken(userId, callId);
    res.json(token);
  } catch (err) {
    next(err);
  }
});

// Join a voice channel
callRoutes.post('/channels/:channelId/join', async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = req.user!.userId;
    const call = await callService.joinVoiceChannel(userId, channelId);
    res.json(call);
  } catch (err) {
    next(err);
  }
});

// Leave a voice channel
callRoutes.post('/channels/:channelId/leave', async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = req.user!.userId;
    await callService.leaveVoiceChannel(userId, channelId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Get active call for a voice channel (participants list)
callRoutes.get('/channels/:channelId/call', async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const call = await callService.getActiveCallForChannel(channelId);
    res.json({ call });
  } catch (err) {
    next(err);
  }
});
