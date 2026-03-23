import { create } from 'zustand';
import { Room, RoomEvent, Track, RemoteParticipant, LocalParticipant, type RemoteTrackPublication, type LocalTrackPublication } from 'livekit-client';
import { api } from '../lib/api.js';
import type { Call, CallToken } from '@crabac/shared';

export interface ParticipantState {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isSpeaking: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
}

interface CallState {
  // Active call state
  activeCall: Call | null;
  room: Room | null;
  participants: ParticipantState[];
  localAudioMuted: boolean;
  localVideoOff: boolean;
  isScreenSharing: boolean;
  connecting: boolean;

  // Incoming call
  incomingCall: (Call & { conversationId?: string }) | null;

  // Voice channel state
  activeVoiceChannelId: string | null;

  // Event room state
  activeEventId: string | null;
  activeEventChannelId: string | null;
  activeEventSpaceId: string | null;
  activeEventName: string | null;

  // Actions
  initiateCall: (conversationId: string) => Promise<void>;
  joinExistingCall: (callId: string) => Promise<void>;
  acceptCall: (callId: string) => Promise<void>;
  declineCall: (callId: string) => Promise<void>;
  leaveCall: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;

  // Voice channel actions
  joinVoiceChannel: (channelId: string) => Promise<void>;
  leaveVoiceChannel: () => Promise<void>;

  // Event room actions
  joinEventCall: (call: Call, token: CallToken, eventId: string, channelId?: string | null, spaceId?: string | null, eventName?: string | null) => Promise<void>;

  // Socket event handlers
  handleIncomingCall: (call: Call, conversationId: string) => void;
  handleCallEnded: (callId: string) => void;
  handleParticipantJoined: (call: Call) => void;
  handleParticipantLeft: (call: Call, userId: string) => void;
  dismissIncoming: () => void;

  // Fetch active call info
  fetchActiveCall: (conversationId: string) => Promise<Call | null>;
  fetchVoiceChannelCall: (channelId: string) => Promise<Call | null>;
}

async function connectToRoom(token: string, wsUrl: string): Promise<Room> {
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  await room.connect(wsUrl, token);
  return room;
}

function buildParticipantState(
  participant: RemoteParticipant | LocalParticipant,
): ParticipantState {
  const isLocal = participant instanceof LocalParticipant;
  const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
  const videoTrack = participant.getTrackPublication(Track.Source.Camera);
  const screenTrack = participant.getTrackPublication(Track.Source.ScreenShare);

  return {
    userId: participant.identity,
    username: participant.name || participant.identity,
    displayName: participant.name || participant.identity,
    avatarUrl: null,
    isSpeaking: participant.isSpeaking,
    isMuted: audioTrack ? audioTrack.isMuted : true,
    isCameraOff: videoTrack ? videoTrack.isMuted : true,
    isScreenSharing: screenTrack ? !screenTrack.isMuted : false,
  };
}

export const useCallStore = create<CallState>((set, get) => ({
  activeCall: null,
  room: null,
  participants: [],
  localAudioMuted: false,
  localVideoOff: true,
  isScreenSharing: false,
  connecting: false,
  incomingCall: null,
  activeVoiceChannelId: null,
  activeEventId: null,
  activeEventChannelId: null,
  activeEventSpaceId: null,
  activeEventName: null,

  initiateCall: async (conversationId) => {
    set({ connecting: true });
    let callId: string | null = null;
    try {
      console.log('[Call] Initiating call for conversation:', conversationId);
      const result = await api<Call & { token: CallToken }>(`/calls/conversations/${conversationId}/call`, {
        method: 'POST',
      });
      callId = result.id;
      console.log('[Call] API response:', { callId: result.id, hasToken: !!result.token, wsUrl: result.token?.wsUrl });
      const { token, ...call } = result;
      console.log('[Call] Connecting to LiveKit room...');
      const room = await connectToRoom(token.token, token.wsUrl);
      console.log('[Call] Connected to room, enabling mic...');

      // Enable microphone
      await room.localParticipant.setMicrophoneEnabled(true);

      setupRoomListeners(room, set, get);
      set({
        activeCall: call,
        room,
        connecting: false,
        localAudioMuted: false,
        localVideoOff: true,
        participants: [buildParticipantState(room.localParticipant)],
      });
    } catch (err) {
      // Clean up the call if we failed to connect to LiveKit
      if (callId) {
        api(`/calls/${callId}/leave`, { method: 'POST' }).catch(() => {});
      }
      set({ connecting: false });
      throw err;
    }
  },

  joinExistingCall: async (callId) => {
    // Leave any current call first
    const { activeCall } = get();
    if (activeCall) {
      await get().leaveCall();
    }

    set({ connecting: true });
    try {
      const result = await api<Call & { token: CallToken }>(`/calls/${callId}/join`, {
        method: 'POST',
      });
      const { token, ...call } = result;
      const room = await connectToRoom(token.token, token.wsUrl);

      await room.localParticipant.setMicrophoneEnabled(true);

      setupRoomListeners(room, set, get);
      set({
        activeCall: call,
        room,
        connecting: false,
        localAudioMuted: false,
        localVideoOff: true,
        participants: getAllParticipantStates(room),
      });
    } catch (err) {
      set({ connecting: false });
      throw err;
    }
  },

  acceptCall: async (callId) => {
    set({ connecting: true, incomingCall: null });
    try {
      const result = await api<Call & { token?: CallToken }>(`/calls/${callId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action: 'accept' }),
      });
      if (!result.token) throw new Error('No token received');
      const { token, ...call } = result;
      const room = await connectToRoom(token!.token, token!.wsUrl);

      await room.localParticipant.setMicrophoneEnabled(true);

      setupRoomListeners(room, set, get);
      set({
        activeCall: call,
        room,
        connecting: false,
        localAudioMuted: false,
        localVideoOff: true,
        participants: getAllParticipantStates(room),
      });
    } catch (err) {
      set({ connecting: false });
      throw err;
    }
  },

  declineCall: async (callId) => {
    set({ incomingCall: null });
    try {
      await api(`/calls/${callId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action: 'decline' }),
      });
    } catch {
      // ignore
    }
  },

  leaveCall: async () => {
    const { room, activeCall, activeVoiceChannelId } = get();

    if (room) {
      room.disconnect();
    }

    if (activeCall) {
      try {
        if (activeVoiceChannelId) {
          await api(`/calls/channels/${activeVoiceChannelId}/leave`, { method: 'POST' });
        } else {
          await api(`/calls/${activeCall.id}/leave`, { method: 'POST' });
        }
      } catch {
        // ignore
      }
    }

    set({
      activeCall: null,
      room: null,
      participants: [],
      localAudioMuted: false,
      localVideoOff: true,
      isScreenSharing: false,
      activeVoiceChannelId: null,
      activeEventId: null,
      activeEventChannelId: null,
      activeEventSpaceId: null,
      activeEventName: null,
    });
  },

  toggleMute: async () => {
    const { room, localAudioMuted } = get();
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(localAudioMuted);
    set({ localAudioMuted: !localAudioMuted });
  },

  toggleCamera: async () => {
    const { room, localVideoOff } = get();
    if (!room) return;
    await room.localParticipant.setCameraEnabled(localVideoOff);
    set({ localVideoOff: !localVideoOff });
  },

  toggleScreenShare: async () => {
    const { room, isScreenSharing } = get();
    if (!room) return;
    await room.localParticipant.setScreenShareEnabled(!isScreenSharing);
    set({ isScreenSharing: !isScreenSharing });
  },

  joinVoiceChannel: async (channelId) => {
    // Leave any existing call first
    const { activeCall } = get();
    if (activeCall) {
      await get().leaveCall();
    }

    set({ connecting: true });
    try {
      const result = await api<Call & { token: CallToken }>(`/calls/channels/${channelId}/join`, {
        method: 'POST',
      });
      const { token, ...call } = result;
      const room = await connectToRoom(token.token, token.wsUrl);

      await room.localParticipant.setMicrophoneEnabled(true);

      setupRoomListeners(room, set, get);
      set({
        activeCall: call,
        room,
        connecting: false,
        activeVoiceChannelId: channelId,
        localAudioMuted: false,
        localVideoOff: true,
        participants: getAllParticipantStates(room),
      });
    } catch (err) {
      set({ connecting: false });
      throw err;
    }
  },

  leaveVoiceChannel: async () => {
    await get().leaveCall();
  },

  joinEventCall: async (call, token, eventId, channelId, spaceId, eventName) => {
    // Leave any existing call first
    const { activeCall } = get();
    if (activeCall) {
      await get().leaveCall();
    }

    set({ connecting: true });
    try {
      const room = await connectToRoom(token.token, token.wsUrl);
      await room.localParticipant.setMicrophoneEnabled(true);

      setupRoomListeners(room, set, get);
      set({
        activeCall: call,
        room,
        connecting: false,
        activeEventId: eventId,
        activeEventChannelId: channelId || null,
        activeEventSpaceId: spaceId || null,
        activeEventName: eventName || null,
        activeVoiceChannelId: null,
        localAudioMuted: false,
        localVideoOff: true,
        participants: getAllParticipantStates(room),
      });
    } catch (err) {
      set({ connecting: false });
      throw err;
    }
  },

  handleIncomingCall: (call, conversationId) => {
    // Don't show incoming if already in a call
    if (get().activeCall) return;
    set({ incomingCall: { ...call, conversationId } });
  },

  handleCallEnded: (callId) => {
    const { activeCall, room, incomingCall } = get();
    if (incomingCall?.id === callId) {
      set({ incomingCall: null });
    }
    if (activeCall?.id === callId) {
      room?.disconnect();
      set({
        activeCall: null,
        room: null,
        participants: [],
        activeVoiceChannelId: null,
        activeEventId: null,
        activeEventChannelId: null,
        activeEventSpaceId: null,
        activeEventName: null,
      });
    }
  },

  handleParticipantJoined: (call) => {
    const { activeCall } = get();
    if (activeCall?.id === call.id) {
      set({ activeCall: call });
    }
  },

  handleParticipantLeft: (call, userId) => {
    const { activeCall } = get();
    if (activeCall?.id === call.id) {
      set({ activeCall: call });
    }
  },

  dismissIncoming: () => {
    set({ incomingCall: null });
  },

  fetchActiveCall: async (conversationId) => {
    try {
      const result = await api<{ call: Call | null }>(`/calls/conversations/${conversationId}/call`);
      return result.call;
    } catch {
      return null;
    }
  },

  fetchVoiceChannelCall: async (channelId) => {
    try {
      const result = await api<{ call: Call | null }>(`/calls/channels/${channelId}/call`);
      return result.call;
    } catch {
      return null;
    }
  },
}));

function getAllParticipantStates(room: Room): ParticipantState[] {
  const states: ParticipantState[] = [buildParticipantState(room.localParticipant)];
  for (const p of room.remoteParticipants.values()) {
    states.push(buildParticipantState(p));
  }
  return states;
}

function setupRoomListeners(
  room: Room,
  set: (fn: Partial<CallState> | ((s: CallState) => Partial<CallState>)) => void,
  get: () => CallState,
) {
  const refreshParticipants = () => {
    set({ participants: getAllParticipantStates(room) });
  };

  room.on(RoomEvent.ParticipantConnected, refreshParticipants);
  room.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
  room.on(RoomEvent.TrackMuted, refreshParticipants);
  room.on(RoomEvent.TrackUnmuted, refreshParticipants);
  room.on(RoomEvent.ActiveSpeakersChanged, refreshParticipants);
  room.on(RoomEvent.TrackSubscribed, refreshParticipants);
  room.on(RoomEvent.TrackUnsubscribed, refreshParticipants);

  // Auto-attach remote audio tracks so they play through speakers
  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (track.kind === Track.Kind.Audio) {
      track.attach();
    }
  });

  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    if (track.kind === Track.Kind.Audio) {
      track.detach();
    }
  });

  room.on(RoomEvent.Disconnected, () => {
    set({
      activeCall: null,
      room: null,
      participants: [],
      activeVoiceChannelId: null,
      activeEventId: null,
      activeEventChannelId: null,
      activeEventSpaceId: null,
      activeEventName: null,
    });
  });
}
