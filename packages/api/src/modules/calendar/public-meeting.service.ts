import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { eventBus } from '../../lib/event-bus.js';
import { createGuestParticipantToken } from '../calls/call.service.js';
import { sendEmail } from '../../lib/email.js';
import { config } from '../../config.js';

// ─── Public Meeting Info ───

export async function getPublicMeetingInfo(eventId: string) {
  const event = await db('calendar_events').where('id', eventId).first();
  if (!event) throw new NotFoundError('Calendar event');
  if (!event.meeting_room_enabled || !event.meeting_public_access) {
    throw new NotFoundError('Public meeting');
  }

  const space = await db('spaces').where('id', event.space_id).first();
  if (!space) throw new NotFoundError('Space');

  const settings = await db('space_settings').where('space_id', space.id).first();
  if (!settings?.allow_public_voice) throw new NotFoundError('Public meeting');

  // Get participant count
  const meetingRoom = await db('event_meeting_rooms').where('event_id', eventId).first();
  let participantCount = 0;
  let guestCount = 0;
  if (meetingRoom?.call_id) {
    const countResult = await db('call_participants')
      .where({ call_id: String(meetingRoom.call_id), status: 'joined' })
      .count('* as count')
      .first();
    participantCount = Number(countResult?.count || 0);

    const guestResult = await db('meeting_room_guests')
      .where({ event_id: eventId, status: 'active' })
      .count('* as count')
      .first();
    guestCount = Number(guestResult?.count || 0);
  }

  return {
    eventId: String(event.id),
    spaceId: String(space.id),
    spaceName: space.name,
    spaceSlug: space.slug,
    eventName: event.name,
    eventDate: event.event_date,
    eventTime: event.event_time || null,
    endTime: event.end_time || null,
    description: event.description || null,
    imageUrl: event.image_url || null,
    meetingPublicChat: !!event.meeting_public_chat,
    meetingPublicParticipation: !!event.meeting_public_participation,
    meetingIdentityMode: event.meeting_identity_mode || 'anonymous',
    meetingHasPassword: !!event.meeting_room_password,
    participantCount: participantCount + guestCount,
    roomStatus: meetingRoom?.status || 'pending',
  };
}

// ─── Join Public Meeting Room ───

export async function joinPublicMeetingRoom(
  eventId: string,
  data: {
    displayName: string;
    password?: string;
    sessionToken?: string;
    inviteToken?: string;
    emailVerificationToken?: string;
    userId?: string; // If authenticated user
  },
) {
  const event = await db('calendar_events').where('id', eventId).first();
  if (!event) throw new NotFoundError('Calendar event');
  if (!event.meeting_room_enabled || !event.meeting_public_access) {
    throw new ForbiddenError('Public access is not enabled for this meeting');
  }

  const space = await db('spaces').where('id', event.space_id).first();
  if (!space) throw new NotFoundError('Space');

  const settings = await db('space_settings').where('space_id', space.id).first();
  if (!settings?.allow_public_voice) {
    throw new ForbiddenError('Public voice access is not enabled for this space');
  }

  const spaceId = String(event.space_id);

  // Check identity mode
  let email: string | null = null;
  let emailVerified = false;

  if (event.meeting_identity_mode === 'require_login') {
    if (!data.userId) {
      throw new ForbiddenError('This meeting requires you to be logged in');
    }
  } else if (event.meeting_identity_mode === 'email_verify') {
    if (data.emailVerificationToken) {
      const verification = await db('meeting_email_verifications')
        .where({ token: data.emailVerificationToken, verified: true })
        .where('expires_at', '>', db.fn.now())
        .first();
      if (!verification) throw new BadRequestError('Invalid or expired email verification');
      if (String(verification.event_id) !== eventId) throw new BadRequestError('Email verification is for a different event');
      email = verification.email;
      emailVerified = true;
    } else if (!data.userId) {
      throw new ForbiddenError('This meeting requires email verification');
    }
  }

  // Check invite token (bypasses password)
  let hasValidInvite = false;
  if (data.inviteToken) {
    const invite = await db('meeting_invites')
      .where({ token: data.inviteToken, event_id: eventId })
      .first();
    if (invite) {
      const expired = invite.expires_at && new Date(invite.expires_at) < new Date();
      const maxedOut = invite.max_uses && invite.use_count >= invite.max_uses;
      if (!expired && !maxedOut) {
        hasValidInvite = true;
        await db('meeting_invites').where('id', invite.id).increment('use_count', 1);
      }
    }
  }

  // Check password (unless invite bypasses it)
  if (event.meeting_room_password && !hasValidInvite) {
    if (!data.password) throw new ForbiddenError('Password required');
    const valid = await bcrypt.compare(data.password, event.meeting_room_password);
    if (!valid) throw new ForbiddenError('Incorrect password');
  }

  // Check for existing session (reconnect)
  if (data.sessionToken) {
    const existing = await db('meeting_room_guests')
      .where({ session_token: data.sessionToken, event_id: eventId })
      .first();
    if (existing) {
      if (existing.status === 'kicked') throw new ForbiddenError('You have been removed from this meeting');
      // Reactivate if left
      if (existing.status === 'left') {
        await db('meeting_room_guests').where('id', existing.id).update({ status: 'active', left_at: null });
      }
      // Get or create the meeting room + call
      const roomData = await ensureMeetingRoom(eventId, event, spaceId, data.userId);
      const token = await createGuestParticipantToken(
        roomData.roomName,
        existing.livekit_identity,
        existing.display_name,
        {
          canPublish: !!event.meeting_public_participation,
          canPublishData: !!event.meeting_public_chat,
        },
      );

      await emitParticipantChanged(eventId, spaceId, roomData.callId);

      return {
        token,
        sessionToken: existing.session_token,
        guestId: String(existing.id),
        channelId: roomData.channelId,
        meetingRoom: roomData.meetingRoomInfo,
      };
    }
  }

  // Create new guest
  const guestId = snowflake.generate();
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const livekitIdentity = `guest_${crypto.randomBytes(8).toString('hex')}`;

  const roomData = await ensureMeetingRoom(eventId, event, spaceId, data.userId);

  await db('meeting_room_guests').insert({
    id: guestId,
    event_id: eventId,
    channel_id: null,
    session_token: sessionToken,
    display_name: data.displayName,
    email,
    email_verified: emailVerified,
    user_id: data.userId || null,
    livekit_identity: livekitIdentity,
    status: 'active',
  });

  const token = await createGuestParticipantToken(
    roomData.roomName,
    livekitIdentity,
    data.displayName,
    {
      canPublish: !!event.meeting_public_participation,
      canPublishData: !!event.meeting_public_chat,
    },
  );

  await emitParticipantChanged(eventId, spaceId, roomData.callId);

  eventBus.emit('calendar.public_guest_joined', {
    eventId: String(eventId),
    spaceId,
    guestId: String(guestId),
    displayName: data.displayName,
  });

  return {
    token,
    sessionToken,
    guestId: String(guestId),
    channelId: roomData.channelId,
    meetingRoom: roomData.meetingRoomInfo,
  };
}

// ─── Leave Public Meeting Room ───

export async function leavePublicMeetingRoom(eventId: string, sessionToken: string) {
  const guest = await db('meeting_room_guests')
    .where({ session_token: sessionToken, event_id: eventId })
    .first();
  if (!guest) throw new NotFoundError('Guest session');

  await db('meeting_room_guests')
    .where('id', guest.id)
    .update({ status: 'left', left_at: db.fn.now(3) });

  const event = await db('calendar_events').where('id', eventId).first();
  const spaceId = event ? String(event.space_id) : null;

  if (spaceId) {
    const meetingRoom = await db('event_meeting_rooms').where('event_id', eventId).first();
    if (meetingRoom?.call_id) {
      await emitParticipantChanged(eventId, spaceId, String(meetingRoom.call_id));
    }
  }

  eventBus.emit('calendar.public_guest_left', {
    eventId: String(eventId),
    spaceId,
    guestId: String(guest.id),
    displayName: guest.display_name,
  });
}

// ─── Kick Public Guest ───

export async function kickPublicGuest(guestId: string, kickedByUserId: string) {
  const guest = await db('meeting_room_guests').where('id', guestId).first();
  if (!guest) throw new NotFoundError('Guest');

  const eventId = guest.event_id ? String(guest.event_id) : null;
  const channelId = guest.channel_id ? String(guest.channel_id) : null;

  await db('meeting_room_guests')
    .where('id', guestId)
    .update({ status: 'kicked', left_at: db.fn.now(3) });

  // Determine spaceId
  let spaceId: string | null = null;
  if (eventId) {
    const event = await db('calendar_events').where('id', eventId).first();
    if (event) spaceId = String(event.space_id);
  } else if (channelId) {
    const channel = await db('channels').where('id', channelId).first();
    if (channel) spaceId = String(channel.space_id);
  }

  // Try to remove from LiveKit room
  try {
    const { RoomServiceClient } = await import('livekit-server-sdk');
    const roomService = new RoomServiceClient(config.livekit.host, config.livekit.apiKey, config.livekit.apiSecret);

    if (eventId) {
      const meetingRoom = await db('event_meeting_rooms').where('event_id', eventId).first();
      if (meetingRoom?.call_id) {
        const call = await db('calls').where('id', meetingRoom.call_id).first();
        if (call) {
          await roomService.removeParticipant(call.room_name, guest.livekit_identity);
        }
      }
    }
  } catch {
    // Guest may have already disconnected
  }

  if (spaceId) {
    eventBus.emit('calendar.public_guest_kicked', {
      eventId,
      channelId,
      spaceId,
      guestId: String(guestId),
      displayName: guest.display_name,
      kickedBy: kickedByUserId,
    });

    if (eventId) {
      const meetingRoom = await db('event_meeting_rooms').where('event_id', eventId).first();
      if (meetingRoom?.call_id) {
        await emitParticipantChanged(eventId, spaceId, String(meetingRoom.call_id));
      }
    }
  }
}

// ─── List Public Guests ───

export async function listPublicGuests(eventId: string) {
  const rows = await db('meeting_room_guests')
    .where({ event_id: eventId, status: 'active' })
    .orderBy('created_at', 'asc');
  return rows.map(formatGuest);
}

// ─── Email Verification ───

export async function requestEmailVerification(
  eventId: string,
  email: string,
  displayName: string,
) {
  const event = await db('calendar_events').where('id', eventId).first();
  if (!event) throw new NotFoundError('Calendar event');
  if (event.meeting_identity_mode !== 'email_verify') {
    throw new BadRequestError('Email verification is not required for this meeting');
  }

  const space = await db('spaces').where('id', event.space_id).first();
  if (!space) throw new NotFoundError('Space');

  const id = snowflake.generate();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db('meeting_email_verifications').insert({
    id,
    event_id: eventId,
    channel_id: null,
    email,
    display_name: displayName,
    token,
    verified: false,
    expires_at: expiresAt,
  });

  const verifyUrl = `${config.appUrl}/calendar/${space.slug}/meeting/${eventId}/verify?token=${token}`;

  await sendEmail(
    email,
    `Verify your email to join "${event.name}"`,
    `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2>Join "${event.name}"</h2>
      <p>Hi ${displayName}, click the button below to verify your email and join the meeting.</p>
      <a href="${verifyUrl}" style="display:inline-block;background:#5865f2;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Verify &amp; Join</a>
      <p style="margin-top:16px;color:#888;font-size:13px;">This link expires in 1 hour.</p>
    </div>`,
  );

  return { sent: true };
}

export async function verifyMeetingEmail(token: string) {
  const verification = await db('meeting_email_verifications')
    .where({ token })
    .where('expires_at', '>', db.fn.now())
    .first();
  if (!verification) throw new BadRequestError('Invalid or expired verification token');

  await db('meeting_email_verifications').where('id', verification.id).update({ verified: true });

  return {
    token: verification.token,
    email: verification.email,
    displayName: verification.display_name,
    eventId: verification.event_id ? String(verification.event_id) : null,
    channelId: verification.channel_id ? String(verification.channel_id) : null,
  };
}

// ─── Meeting Invites ───

export async function createMeetingInvite(
  eventId: string,
  createdByUserId: string,
  data: {
    email?: string;
    maxUses?: number | null;
    expiresInHours?: number | null;
  },
) {
  const event = await db('calendar_events').where('id', eventId).first();
  if (!event) throw new NotFoundError('Calendar event');

  const id = snowflake.generate();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = data.expiresInHours
    ? new Date(Date.now() + data.expiresInHours * 60 * 60 * 1000)
    : null;

  await db('meeting_invites').insert({
    id,
    event_id: eventId,
    channel_id: null,
    token,
    email: data.email || null,
    created_by: createdByUserId,
    max_uses: data.maxUses ?? null,
    use_count: 0,
    expires_at: expiresAt,
  });

  const space = await db('spaces').where('id', event.space_id).first();
  const inviteUrl = `${config.appUrl}/calendar/${space?.slug}/meeting/${eventId}?invite=${token}`;

  // Optionally email the invite with ICS attachment
  if (data.email) {
    const icsContent = generateEventIcs(event, space, inviteUrl);
    await sendEmail(
      data.email,
      `You're invited to "${event.name}"`,
      `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2>You're invited!</h2>
        <p>You've been invited to join the meeting for "${event.name}".</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#5865f2;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Join Meeting</a>
        <p style="margin-top:16px;color:#888;font-size:13px;">This invite ${data.expiresInHours ? `expires in ${data.expiresInHours} hours` : 'does not expire'}.</p>
      </div>`,
      [{ filename: 'invite.ics', content: icsContent, contentType: 'text/calendar' }],
    );
  }

  return {
    id: String(id),
    eventId: String(eventId),
    token,
    inviteUrl,
    email: data.email || null,
    maxUses: data.maxUses ?? null,
    useCount: 0,
    expiresAt: expiresAt?.toISOString() || null,
  };
}

export async function listMeetingInvites(eventId: string) {
  const rows = await db('meeting_invites')
    .where('event_id', eventId)
    .orderBy('created_at', 'desc');

  const space = await db('calendar_events')
    .join('spaces', 'spaces.id', 'calendar_events.space_id')
    .where('calendar_events.id', eventId)
    .select('spaces.slug')
    .first();

  return rows.map((row) => ({
    id: String(row.id),
    eventId: String(row.event_id),
    token: row.token,
    inviteUrl: `${config.appUrl}/calendar/${space?.slug}/meeting/${eventId}?invite=${row.token}`,
    email: row.email,
    maxUses: row.max_uses,
    useCount: row.use_count,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export async function deleteMeetingInvite(inviteId: string, eventId: string) {
  const deleted = await db('meeting_invites')
    .where({ id: inviteId, event_id: eventId })
    .delete();
  if (!deleted) throw new NotFoundError('Meeting invite');
}

// ─── Helpers ───

async function ensureMeetingRoom(eventId: string, event: any, spaceId: string, userId?: string) {
  let meetingRoom = await db('event_meeting_rooms').where('event_id', eventId).first();

  if (!meetingRoom) {
    await db('event_meeting_rooms').insert({
      event_id: eventId,
      status: 'open',
    });
    meetingRoom = await db('event_meeting_rooms').where('event_id', eventId).first();
  }

  let callId: string;
  let roomName: string;

  if (!meetingRoom.call_id) {
    const newCallId = snowflake.generate();
    callId = String(newCallId);
    roomName = `event_${eventId}_${newCallId}`;

    await db('calls').insert({
      id: newCallId,
      type: 'voice_channel',
      channel_id: null,
      space_id: event.space_id,
      room_name: roomName,
      initiated_by: userId || null,
      status: 'active',
      started_at: db.fn.now(3),
    });

    await db('event_meeting_rooms').where('event_id', eventId).update({ call_id: callId });
  } else {
    callId = String(meetingRoom.call_id);
    const call = await db('calls').where('id', callId).first();
    if (!call) throw new NotFoundError('Call');
    roomName = call.room_name;
  }

  // Create temp text channel if not yet created
  if (!meetingRoom.channel_id) {
    const channelId = snowflake.generate();
    await db('channels').insert({
      id: channelId,
      space_id: event.space_id,
      name: `event-room-${eventId}`,
      display_name: event.name,
      type: 'text',
      position: -1,
      is_private: true,
    });
    await db('event_meeting_rooms').where('event_id', eventId).update({ channel_id: channelId });
    meetingRoom.channel_id = channelId;
  }

  return {
    callId,
    roomName,
    channelId: String(meetingRoom.channel_id),
    meetingRoomInfo: {
      status: meetingRoom.status,
      callId,
    },
  };
}

async function emitParticipantChanged(eventId: string, spaceId: string, callId: string) {
  const memberCount = await db('call_participants')
    .where({ call_id: callId, status: 'joined' })
    .count('* as count')
    .first();
  const guestCount = await db('meeting_room_guests')
    .where({ event_id: eventId, status: 'active' })
    .count('* as count')
    .first();

  const participantCount = Number(memberCount?.count || 0) + Number(guestCount?.count || 0);

  eventBus.emit('calendar.room.participant_changed', {
    eventId: String(eventId),
    spaceId,
    participantCount,
  });
}

function formatGuest(row: any) {
  return {
    id: String(row.id),
    eventId: row.event_id ? String(row.event_id) : null,
    channelId: row.channel_id ? String(row.channel_id) : null,
    displayName: row.display_name,
    email: row.email || null,
    emailVerified: !!row.email_verified,
    livekitIdentity: row.livekit_identity,
    status: row.status,
    createdAt: row.created_at,
  };
}

// ─── Public Voice Channel ───

export async function getPublicVoiceChannelInfo(channelId: string) {
  const channel = await db('channels').where('id', channelId).first();
  if (!channel) throw new NotFoundError('Channel');
  if (channel.type !== 'voice' || !channel.public_voice_access) {
    throw new NotFoundError('Public voice channel');
  }

  const space = await db('spaces').where('id', channel.space_id).first();
  if (!space) throw new NotFoundError('Space');

  const settings = await db('space_settings').where('space_id', space.id).first();
  if (!settings?.allow_public_voice) throw new NotFoundError('Public voice channel');

  // Get participant counts
  const call = await db('calls')
    .where({ channel_id: channelId, type: 'voice_channel' })
    .whereIn('status', ['active', 'ringing'])
    .first();

  let participantCount = 0;
  if (call) {
    const memberCount = await db('call_participants')
      .where({ call_id: String(call.id), status: 'joined' })
      .count('* as count')
      .first();
    const guestCount = await db('meeting_room_guests')
      .where({ channel_id: channelId, status: 'active' })
      .count('* as count')
      .first();
    participantCount = Number(memberCount?.count || 0) + Number(guestCount?.count || 0);
  }

  return {
    channelId: String(channel.id),
    spaceId: String(space.id),
    spaceName: space.name,
    spaceSlug: space.slug,
    channelName: channel.name,
    channelDisplayName: channel.display_name || channel.name,
    topic: channel.topic || null,
    publicVoiceChat: !!channel.public_voice_chat,
    publicVoiceParticipation: !!channel.public_voice_participation,
    voiceIdentityMode: channel.voice_identity_mode || 'anonymous',
    voiceHasPassword: !!channel.voice_password,
    participantCount,
  };
}

export async function joinPublicVoiceChannel(
  channelId: string,
  data: {
    displayName: string;
    password?: string;
    sessionToken?: string;
    inviteToken?: string;
    emailVerificationToken?: string;
    userId?: string;
  },
) {
  const channel = await db('channels').where('id', channelId).first();
  if (!channel) throw new NotFoundError('Channel');
  if (channel.type !== 'voice' || !channel.public_voice_access) {
    throw new ForbiddenError('Public access is not enabled for this voice channel');
  }

  const space = await db('spaces').where('id', channel.space_id).first();
  if (!space) throw new NotFoundError('Space');

  const settings = await db('space_settings').where('space_id', space.id).first();
  if (!settings?.allow_public_voice) {
    throw new ForbiddenError('Public voice access is not enabled for this space');
  }

  const spaceId = String(channel.space_id);

  // Check identity mode
  let email: string | null = null;
  let emailVerified = false;

  if (channel.voice_identity_mode === 'require_login') {
    if (!data.userId) throw new ForbiddenError('This voice channel requires you to be logged in');
  } else if (channel.voice_identity_mode === 'email_verify') {
    if (data.emailVerificationToken) {
      const verification = await db('meeting_email_verifications')
        .where({ token: data.emailVerificationToken, verified: true })
        .where('expires_at', '>', db.fn.now())
        .first();
      if (!verification) throw new BadRequestError('Invalid or expired email verification');
      if (String(verification.channel_id) !== channelId) throw new BadRequestError('Email verification is for a different channel');
      email = verification.email;
      emailVerified = true;
    } else if (!data.userId) {
      throw new ForbiddenError('This voice channel requires email verification');
    }
  }

  // Check invite token (bypasses password)
  let hasValidInvite = false;
  if (data.inviteToken) {
    const invite = await db('meeting_invites')
      .where({ token: data.inviteToken, channel_id: channelId })
      .first();
    if (invite) {
      const expired = invite.expires_at && new Date(invite.expires_at) < new Date();
      const maxedOut = invite.max_uses && invite.use_count >= invite.max_uses;
      if (!expired && !maxedOut) {
        hasValidInvite = true;
        await db('meeting_invites').where('id', invite.id).increment('use_count', 1);
      }
    }
  }

  // Check password
  if (channel.voice_password && !hasValidInvite) {
    if (!data.password) throw new ForbiddenError('Password required');
    const valid = await bcrypt.compare(data.password, channel.voice_password);
    if (!valid) throw new ForbiddenError('Incorrect password');
  }

  // Check for existing session (reconnect)
  if (data.sessionToken) {
    const existing = await db('meeting_room_guests')
      .where({ session_token: data.sessionToken, channel_id: channelId })
      .first();
    if (existing) {
      if (existing.status === 'kicked') throw new ForbiddenError('You have been removed from this channel');
      if (existing.status === 'left') {
        await db('meeting_room_guests').where('id', existing.id).update({ status: 'active', left_at: null });
      }
      const callData = await ensureVoiceChannelCall(channelId, channel, data.userId);
      const token = await createGuestParticipantToken(
        callData.roomName,
        existing.livekit_identity,
        existing.display_name,
        {
          canPublish: !!channel.public_voice_participation,
          canPublishData: !!channel.public_voice_chat,
        },
      );
      return { token, sessionToken: existing.session_token, guestId: String(existing.id), channelId: String(channelId) };
    }
  }

  // Create new guest
  const guestId = snowflake.generate();
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const livekitIdentity = `guest_${crypto.randomBytes(8).toString('hex')}`;

  const callData = await ensureVoiceChannelCall(channelId, channel, data.userId);

  await db('meeting_room_guests').insert({
    id: guestId,
    event_id: null,
    channel_id: channelId,
    session_token: sessionToken,
    display_name: data.displayName,
    email,
    email_verified: emailVerified,
    user_id: data.userId || null,
    livekit_identity: livekitIdentity,
    status: 'active',
  });

  const token = await createGuestParticipantToken(
    callData.roomName,
    livekitIdentity,
    data.displayName,
    {
      canPublish: !!channel.public_voice_participation,
      canPublishData: !!channel.public_voice_chat,
    },
  );

  eventBus.emit('calendar.public_guest_joined', {
    eventId: null,
    channelId: String(channelId),
    spaceId,
    guestId: String(guestId),
    displayName: data.displayName,
  });

  return { token, sessionToken, guestId: String(guestId), channelId: String(channelId) };
}

export async function leavePublicVoiceChannel(channelId: string, sessionToken: string) {
  const guest = await db('meeting_room_guests')
    .where({ session_token: sessionToken, channel_id: channelId })
    .first();
  if (!guest) throw new NotFoundError('Guest session');

  await db('meeting_room_guests')
    .where('id', guest.id)
    .update({ status: 'left', left_at: db.fn.now(3) });

  const channel = await db('channels').where('id', channelId).first();
  const spaceId = channel ? String(channel.space_id) : null;

  if (spaceId) {
    eventBus.emit('calendar.public_guest_left', {
      eventId: null,
      channelId: String(channelId),
      spaceId,
      guestId: String(guest.id),
      displayName: guest.display_name,
    });
  }
}

export async function requestVoiceChannelEmailVerification(
  channelId: string,
  email: string,
  displayName: string,
) {
  const channel = await db('channels').where('id', channelId).first();
  if (!channel) throw new NotFoundError('Channel');
  if (channel.voice_identity_mode !== 'email_verify') {
    throw new BadRequestError('Email verification is not required for this channel');
  }

  const space = await db('spaces').where('id', channel.space_id).first();
  if (!space) throw new NotFoundError('Space');

  const id = snowflake.generate();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await db('meeting_email_verifications').insert({
    id,
    event_id: null,
    channel_id: channelId,
    email,
    display_name: displayName,
    token,
    verified: false,
    expires_at: expiresAt,
  });

  const verifyUrl = `${config.appUrl}/${space.slug}/voice/${channel.name}/verify?token=${token}`;

  await sendEmail(
    email,
    `Verify your email to join "${channel.display_name || channel.name}"`,
    `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2>Join "${channel.display_name || channel.name}"</h2>
      <p>Hi ${displayName}, click the button below to verify your email and join the voice channel.</p>
      <a href="${verifyUrl}" style="display:inline-block;background:#5865f2;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Verify &amp; Join</a>
      <p style="margin-top:16px;color:#888;font-size:13px;">This link expires in 1 hour.</p>
    </div>`,
  );

  return { sent: true };
}

async function ensureVoiceChannelCall(channelId: string, channel: any, userId?: string) {
  let call = await db('calls')
    .where({ channel_id: channelId, type: 'voice_channel' })
    .whereIn('status', ['active', 'ringing'])
    .first();

  if (!call) {
    const newId = snowflake.generate();
    const roomName = `vc_${channelId}_${newId}`;

    await db('calls').insert({
      id: newId,
      type: 'voice_channel',
      channel_id: channelId,
      space_id: channel.space_id,
      room_name: roomName,
      initiated_by: userId || null,
      status: 'active',
      started_at: db.fn.now(3),
    });

    call = await db('calls').where('id', newId).first();
  }

  return { callId: String(call.id), roomName: call.room_name };
}

// ─── ICS Generation for Invite Emails ───

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function generateEventIcs(event: any, space: any, meetingUrl: string): string {
  const uid = `${event.id}@crab.ac`;
  const dateStr = (event.event_date || '').replace(/-/g, '');
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

  let dtStart: string;
  let dtEnd: string;

  if (event.event_time) {
    const timePart = event.event_time.replace(':', '') + '00';
    dtStart = `${dateStr}T${timePart}`;
    if (event.end_time) {
      const endPart = event.end_time.replace(':', '') + '00';
      dtEnd = `${dateStr}T${endPart}`;
    } else {
      const [h, m] = event.event_time.split(':').map(Number);
      const endMin = h * 60 + m + 120;
      const eh = String(Math.floor(endMin / 60) % 24).padStart(2, '0');
      const em = String(endMin % 60).padStart(2, '0');
      dtEnd = `${dateStr}T${eh}${em}00`;
    }
  } else {
    dtStart = dateStr;
    const d = new Date(event.event_date + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    dtEnd = d.toISOString().split('T')[0].replace(/-/g, '');
  }

  const description = event.description
    ? `${escapeIcs(event.description)}\\n\\nJoin meeting: ${meetingUrl}`
    : `Join meeting: ${meetingUrl}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//crab.ac//${escapeIcs(space.name)}//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    event.event_time ? `DTSTART:${dtStart}` : `DTSTART;VALUE=DATE:${dtStart}`,
    event.event_time ? `DTEND:${dtEnd}` : `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${escapeIcs(event.name)}`,
    `DESCRIPTION:${description}`,
    `URL:${meetingUrl}`,
    `DTSTAMP:${now}`,
    `X-MEETING-URL:${meetingUrl}`,
  ];

  if (event.location) {
    lines.push(`LOCATION:${escapeIcs(event.location)}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
