import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { config } from '../../config.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { eventBus } from '../../lib/event-bus.js';
import * as dmService from '../dm/dm.service.js';
import * as spacesService from '../spaces/spaces.service.js';
import { computeChannelPermissions } from '../rbac/rbac.service.js';
import { hasPermission, Permissions } from '@crabac/shared';
import type { Call, CallParticipant, CallToken } from '@crabac/shared';

const roomService = new RoomServiceClient(
  config.livekit.host,
  config.livekit.apiKey,
  config.livekit.apiSecret,
);

// ─── Token Generation ───

export async function createParticipantToken(roomName: string, userId: string, username: string): Promise<CallToken> {
  const token = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: userId,
    name: username,
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return {
    token: await token.toJwt(),
    wsUrl: config.livekit.wsUrl,
  };
}

// ─── DM / Group DM Calls ───

export async function initiateCall(userId: string, conversationId: string): Promise<Call & { token: CallToken }> {
  // Verify user is a member of the conversation
  const isMember = await dmService.isConversationMember(conversationId, userId);
  if (!isMember) throw new ForbiddenError('Not a member of this conversation');

  // Check for existing active call in this conversation
  const existingCall = await db('calls')
    .where({ conversation_id: conversationId })
    .whereIn('status', ['ringing', 'active'])
    .first();

  if (existingCall) {
    throw new BadRequestError('A call is already in progress for this conversation', {
      existingCallId: String(existingCall.id),
    });
  }

  const callId = snowflake.generate();
  const roomName = `call_${callId}`;

  // Get conversation members
  const members = await db('conversation_members')
    .where({ conversation_id: conversationId, status: 'accepted' })
    .select('user_id');

  await db('calls').insert({
    id: callId,
    type: 'dm',
    conversation_id: conversationId,
    room_name: roomName,
    initiated_by: userId,
    status: 'ringing',
  });

  // Add all members as participants
  const participantRows = members.map((m: any) => ({
    call_id: callId,
    user_id: m.user_id,
    status: String(m.user_id) === userId ? 'joined' : 'ringing',
    joined_at: String(m.user_id) === userId ? db.fn.now(3) : null,
  }));
  await db('call_participants').insert(participantRows);

  const call = await getCall(String(callId));
  if (!call) throw new NotFoundError('Call');

  // Get caller info for token
  const user = await db('users').where('id', userId).select('username').first();
  const token = await createParticipantToken(roomName, userId, user?.username || 'Unknown');

  // Emit ringing event to all other participants
  eventBus.emit('call.ringing', {
    call,
    callerId: userId,
    conversationId,
  });

  return { ...call, token };
}

export async function respondToCall(
  userId: string,
  callId: string,
  action: 'accept' | 'decline',
): Promise<(Call & { token?: CallToken }) | null> {
  const call = await db('calls').where('id', callId).first();
  if (!call) throw new NotFoundError('Call');
  if (call.status === 'ended') throw new BadRequestError('Call has already ended');

  const participant = await db('call_participants')
    .where({ call_id: callId, user_id: userId })
    .first();
  if (!participant) throw new ForbiddenError('Not a participant in this call');
  if (participant.status !== 'ringing') throw new BadRequestError('Already responded to this call');

  if (action === 'accept') {
    await db('call_participants')
      .where({ call_id: callId, user_id: userId })
      .update({ status: 'joined', joined_at: db.fn.now(3) });

    // If call was ringing, move to active
    if (call.status === 'ringing') {
      await db('calls')
        .where('id', callId)
        .update({ status: 'active', started_at: db.fn.now(3) });
    }

    const updatedCall = await getCall(callId);
    const user = await db('users').where('id', userId).select('username').first();
    const token = await createParticipantToken(call.room_name, userId, user?.username || 'Unknown');

    eventBus.emit('call.participant_joined', {
      call: updatedCall,
      userId,
      conversationId: call.conversation_id ? String(call.conversation_id) : null,
      channelId: call.channel_id ? String(call.channel_id) : null,
    });

    return { ...updatedCall!, token };
  } else {
    await db('call_participants')
      .where({ call_id: callId, user_id: userId })
      .update({ status: 'declined' });

    // Check if all non-initiator participants have declined
    const remaining = await db('call_participants')
      .where({ call_id: callId, status: 'ringing' })
      .count('* as count')
      .first();

    if (Number(remaining?.count) === 0) {
      // Everyone declined or left, end the call
      await endCallInternal(callId);
    }

    const updatedCall = await getCall(callId);
    eventBus.emit('call.participant_declined', {
      call: updatedCall,
      userId,
      conversationId: call.conversation_id ? String(call.conversation_id) : null,
    });

    return updatedCall;
  }
}

export async function leaveCall(userId: string, callId: string): Promise<void> {
  const call = await db('calls').where('id', callId).first();
  if (!call) throw new NotFoundError('Call');

  const participant = await db('call_participants')
    .where({ call_id: callId, user_id: userId })
    .first();
  if (!participant) throw new ForbiddenError('Not a participant in this call');

  await db('call_participants')
    .where({ call_id: callId, user_id: userId })
    .update({ status: 'left', left_at: db.fn.now(3) });

  // Check if any joined participants remain
  const remaining = await db('call_participants')
    .where({ call_id: callId, status: 'joined' })
    .count('* as count')
    .first();

  const updatedCall = await getCall(callId);

  eventBus.emit('call.participant_left', {
    call: updatedCall,
    userId,
    conversationId: call.conversation_id ? String(call.conversation_id) : null,
    channelId: call.channel_id ? String(call.channel_id) : null,
  });

  // DM calls: end when fewer than 2 participants remain (no point in a solo call)
  // Voice channels: end only when completely empty
  const threshold = call.type === 'dm' ? 2 : 1;
  if (Number(remaining?.count) < threshold) {
    await endCallInternal(callId);
  }
}

// ─── Voice Channel Calls ───

export async function joinVoiceChannel(userId: string, channelId: string): Promise<Call & { token: CallToken }> {
  // Verify the channel exists and is a voice channel
  const channel = await db('channels').where('id', channelId).first();
  if (!channel) throw new NotFoundError('Channel');
  if (channel.type !== 'voice') throw new BadRequestError('Not a voice channel');

  const spaceId = String(channel.space_id);

  // Check membership and permissions
  const isMember = await spacesService.isMember(spaceId, userId);
  if (!isMember) throw new ForbiddenError('Not a member of this space');

  const perms = await computeChannelPermissions(spaceId, channelId, userId);
  if (!hasPermission(perms, Permissions.VIEW_CHANNELS)) {
    throw new ForbiddenError('No access to this channel');
  }

  // Find or create the persistent call for this voice channel
  let call = await db('calls')
    .where({ channel_id: channelId, type: 'voice_channel' })
    .whereIn('status', ['active', 'ringing'])
    .first();

  let callId: string;

  if (!call) {
    // Create a new call for this voice channel
    const newId = snowflake.generate();
    callId = String(newId);
    const roomName = `vc_${channelId}_${newId}`;

    await db('calls').insert({
      id: newId,
      type: 'voice_channel',
      channel_id: channelId,
      space_id: channel.space_id,
      room_name: roomName,
      initiated_by: userId,
      status: 'active',
      started_at: db.fn.now(3),
    });

    call = await db('calls').where('id', newId).first();
  } else {
    callId = String(call.id);
  }

  // Add or update participant
  const existingParticipant = await db('call_participants')
    .where({ call_id: callId, user_id: userId })
    .first();

  if (existingParticipant) {
    await db('call_participants')
      .where({ call_id: callId, user_id: userId })
      .update({ status: 'joined', joined_at: db.fn.now(3), left_at: null });
  } else {
    await db('call_participants').insert({
      call_id: callId,
      user_id: userId,
      status: 'joined',
      joined_at: db.fn.now(3),
    });
  }

  const user = await db('users').where('id', userId).select('username').first();
  const token = await createParticipantToken(call.room_name, userId, user?.username || 'Unknown');
  const fullCall = await getCall(callId);

  eventBus.emit('call.participant_joined', {
    call: fullCall,
    userId,
    channelId,
    spaceId,
  });

  return { ...fullCall!, token };
}

export async function leaveVoiceChannel(userId: string, channelId: string): Promise<void> {
  const call = await db('calls')
    .where({ channel_id: channelId, type: 'voice_channel' })
    .whereIn('status', ['active', 'ringing'])
    .first();

  if (!call) return; // No active call, nothing to leave

  await db('call_participants')
    .where({ call_id: call.id, user_id: userId })
    .update({ status: 'left', left_at: db.fn.now(3) });

  // Check if any joined participants remain
  const remaining = await db('call_participants')
    .where({ call_id: call.id, status: 'joined' })
    .count('* as count')
    .first();

  const updatedCall = await getCall(String(call.id));

  eventBus.emit('call.participant_left', {
    call: updatedCall,
    userId,
    channelId,
    spaceId: call.space_id ? String(call.space_id) : null,
  });

  // End call if no one is left
  if (Number(remaining?.count) === 0) {
    await endCallInternal(String(call.id));
  }
}

// ─── Queries ───

export async function getCall(callId: string): Promise<Call | null> {
  const call = await db('calls').where('id', callId).first();
  if (!call) return null;
  return formatCall(call);
}

export async function getActiveCallForConversation(conversationId: string): Promise<Call | null> {
  const call = await db('calls')
    .where({ conversation_id: conversationId })
    .whereIn('status', ['ringing', 'active'])
    .first();

  if (!call) return null;
  return formatCall(call);
}

export async function getActiveCallForChannel(channelId: string): Promise<Call | null> {
  const call = await db('calls')
    .where({ channel_id: channelId, type: 'voice_channel' })
    .whereIn('status', ['active'])
    .first();

  if (!call) return null;
  return formatCall(call);
}

export async function getCallToken(userId: string, callId: string): Promise<CallToken> {
  const call = await db('calls').where('id', callId).first();
  if (!call) throw new NotFoundError('Call');
  if (call.status === 'ended') throw new BadRequestError('Call has ended');

  const participant = await db('call_participants')
    .where({ call_id: callId, user_id: userId, status: 'joined' })
    .first();
  if (!participant) throw new ForbiddenError('Not an active participant');

  const user = await db('users').where('id', userId).select('username').first();
  return createParticipantToken(call.room_name, userId, user?.username || 'Unknown');
}

export async function joinExistingCall(userId: string, callId: string): Promise<Call & { token: CallToken }> {
  const call = await db('calls').where('id', callId).first();
  if (!call) throw new NotFoundError('Call');
  if (call.status === 'ended') throw new BadRequestError('Call has ended');

  // Check user is a participant (in any status)
  const participant = await db('call_participants')
    .where({ call_id: callId, user_id: userId })
    .first();
  if (!participant) throw new ForbiddenError('Not a participant in this call');

  // Re-join: update status to joined
  await db('call_participants')
    .where({ call_id: callId, user_id: userId })
    .update({ status: 'joined', joined_at: db.fn.now(3), left_at: null });

  // If call was ringing, move to active
  if (call.status === 'ringing') {
    await db('calls')
      .where('id', callId)
      .update({ status: 'active', started_at: db.fn.now(3) });
  }

  const updatedCall = await getCall(callId);
  const user = await db('users').where('id', userId).select('username').first();
  const token = await createParticipantToken(call.room_name, userId, user?.username || 'Unknown');

  eventBus.emit('call.participant_joined', {
    call: updatedCall,
    userId,
    conversationId: call.conversation_id ? String(call.conversation_id) : null,
    channelId: call.channel_id ? String(call.channel_id) : null,
  });

  return { ...updatedCall!, token };
}

export async function forceEndCall(userId: string, callId: string): Promise<void> {
  const call = await db('calls').where('id', callId).first();
  if (!call) throw new NotFoundError('Call');
  if (call.status === 'ended') return;

  const participant = await db('call_participants')
    .where({ call_id: callId, user_id: userId })
    .first();
  if (!participant) throw new ForbiddenError('Not a participant in this call');

  await endCallInternal(callId);
}

// ─── Internal Helpers ───

async function endCallInternal(callId: string): Promise<void> {
  await db('calls')
    .where('id', callId)
    .update({ status: 'ended', ended_at: db.fn.now(3) });

  // Mark any still-ringing participants as missed
  await db('call_participants')
    .where({ call_id: callId, status: 'ringing' })
    .update({ status: 'missed' });

  // Remove the LiveKit room (fire-and-forget)
  const call = await db('calls').where('id', callId).first();
  if (call) {
    roomService.deleteRoom(call.room_name).catch(() => {});
  }

  const fullCall = await getCall(callId);
  eventBus.emit('call.ended', {
    call: fullCall,
    conversationId: call?.conversation_id ? String(call.conversation_id) : null,
    channelId: call?.channel_id ? String(call.channel_id) : null,
    spaceId: call?.space_id ? String(call.space_id) : null,
  });

  // Send system message to DM conversation
  if (call?.conversation_id && call.type === 'dm') {
    try {
      const participants = await db('call_participants')
        .where('call_id', callId)
        .select('user_id', 'status');

      const missed = participants.filter((p: any) => p.status === 'missed');
      const joined = participants.filter((p: any) => p.status === 'joined' || p.status === 'left');

      if (joined.length <= 1 && missed.length > 0) {
        // No one picked up — missed call
        await dmService.sendSystemMessage(
          String(call.conversation_id),
          String(call.initiated_by),
          '📞 Missed call',
        );
      } else if (call.started_at && call.ended_at) {
        // Successful call — show duration
        const start = new Date(call.started_at).getTime();
        const end = new Date(call.ended_at).getTime();
        const durationMs = end - start;
        const duration = formatDuration(durationMs);
        await dmService.sendSystemMessage(
          String(call.conversation_id),
          String(call.initiated_by),
          `📞 Call ended — ${duration}`,
        );
      }
    } catch {
      // Don't let system message failures break call cleanup
    }
  }
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function formatCall(call: any): Promise<Call> {
  const participants = await db('call_participants')
    .join('users', 'call_participants.user_id', 'users.id')
    .where('call_participants.call_id', call.id)
    .select(
      'call_participants.user_id',
      'call_participants.status',
      'call_participants.joined_at',
      'call_participants.left_at',
      'users.username',
      'users.display_name',
      'users.avatar_url',
      'users.base_color',
      'users.accent_color',
    );

  return {
    id: String(call.id),
    type: call.type,
    conversationId: call.conversation_id ? String(call.conversation_id) : null,
    channelId: call.channel_id ? String(call.channel_id) : null,
    spaceId: call.space_id ? String(call.space_id) : null,
    roomName: call.room_name,
    initiatedBy: String(call.initiated_by),
    status: call.status,
    startedAt: call.started_at,
    endedAt: call.ended_at,
    createdAt: call.created_at,
    participants: participants.map((p: any): CallParticipant => ({
      userId: String(p.user_id),
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      baseColor: p.base_color || null,
      accentColor: p.accent_color || null,
      status: p.status,
      joinedAt: p.joined_at,
      leftAt: p.left_at,
    })),
  };
}
