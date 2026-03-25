import { create } from 'zustand';
import { Room, RoomEvent, Track, RemoteParticipant, LocalParticipant } from 'livekit-client';
import { api } from '../lib/api.js';

export interface PublicMeetingInfo {
  eventId?: string;
  channelId?: string;
  spaceSlug: string;
  spaceName: string;
  name: string;
  description?: string | null;
  eventDate?: string;
  eventTime?: string | null;
  endTime?: string | null;
  imageUrl?: string | null;
  publicChat: boolean;
  publicParticipation: boolean;
  identityMode: 'anonymous' | 'email_verify' | 'require_login';
  hasPassword: boolean;
  participantCount: number;
  roomStatus: string;
}

export interface GuestParticipant {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
}

interface PublicMeetingState {
  // Connection state
  info: PublicMeetingInfo | null;
  room: Room | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;

  // Session
  sessionToken: string | null;
  guestId: string | null;
  chatChannelId: string | null;

  // Participants
  participants: GuestParticipant[];
  localAudioMuted: boolean;
  localVideoOff: boolean;

  // Actions
  fetchMeetingInfo: (spaceSlug: string, eventId: string) => Promise<void>;
  fetchVoiceChannelInfo: (spaceSlug: string, channelName: string) => Promise<void>;
  joinMeeting: (spaceSlug: string, eventId: string, data: JoinData) => Promise<void>;
  joinVoiceChannel: (spaceSlug: string, channelName: string, data: JoinData) => Promise<void>;
  leaveMeeting: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  requestEmailVerification: (spaceSlug: string, eventId: string, email: string, displayName: string) => Promise<void>;
  requestVoiceEmailVerification: (spaceSlug: string, channelName: string, email: string, displayName: string) => Promise<void>;
  reset: () => void;
}

interface JoinData {
  displayName: string;
  password?: string;
  sessionToken?: string;
  inviteToken?: string;
  emailVerificationToken?: string;
}

const initialState = {
  info: null,
  room: null,
  connected: false,
  connecting: false,
  error: null,
  sessionToken: null,
  guestId: null,
  chatChannelId: null,
  participants: [],
  localAudioMuted: true,
  localVideoOff: true,
};

export const usePublicMeetingStore = create<PublicMeetingState>((set, get) => ({
  ...initialState,

  fetchMeetingInfo: async (spaceSlug, eventId) => {
    try {
      const data = await api(`/public/calendar/${spaceSlug}/events/${eventId}/meeting`);
      set({
        info: {
          eventId: data.eventId,
          spaceSlug: data.spaceSlug,
          spaceName: data.spaceName,
          name: data.eventName,
          description: data.description,
          eventDate: data.eventDate,
          eventTime: data.eventTime,
          endTime: data.endTime,
          imageUrl: data.imageUrl,
          publicChat: data.meetingPublicChat,
          publicParticipation: data.meetingPublicParticipation,
          identityMode: data.meetingIdentityMode,
          hasPassword: data.meetingHasPassword,
          participantCount: data.participantCount,
          roomStatus: data.roomStatus,
        },
        error: null,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load meeting info' });
    }
  },

  fetchVoiceChannelInfo: async (spaceSlug, channelName) => {
    try {
      const data = await api(`/public/${spaceSlug}/voice/${channelName}/meeting`);
      set({
        info: {
          channelId: data.channelId,
          spaceSlug: data.spaceSlug,
          spaceName: data.spaceName,
          name: data.channelDisplayName,
          publicChat: data.publicVoiceChat,
          publicParticipation: data.publicVoiceParticipation,
          identityMode: data.voiceIdentityMode,
          hasPassword: data.voiceHasPassword,
          participantCount: data.participantCount,
          roomStatus: 'open',
        },
        error: null,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load channel info' });
    }
  },

  joinMeeting: async (spaceSlug, eventId, data) => {
    set({ connecting: true, error: null });
    try {
      const savedSession = get().sessionToken || data.sessionToken;
      const result = await api(`/public/calendar/${spaceSlug}/events/${eventId}/meeting/join`, {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          sessionToken: savedSession,
        }),
      });

      const room = await connectRoom(result.token.token, result.token.wsUrl);
      setupRoomListeners(room, set, get);

      set({
        room,
        connected: true,
        connecting: false,
        sessionToken: result.sessionToken,
        guestId: result.guestId,
        chatChannelId: result.channelId || null,
      });

      // Store session for reconnect
      localStorage.setItem(`meeting_session_${eventId}`, result.sessionToken);
    } catch (err: any) {
      set({ connecting: false, error: err.message || 'Failed to join meeting' });
    }
  },

  joinVoiceChannel: async (spaceSlug, channelName, data) => {
    set({ connecting: true, error: null });
    try {
      const result = await api(`/public/${spaceSlug}/voice/${channelName}/meeting/join`, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      const room = await connectRoom(result.token.token, result.token.wsUrl);
      setupRoomListeners(room, set, get);

      set({
        room,
        connected: true,
        connecting: false,
        sessionToken: result.sessionToken,
        guestId: result.guestId,
        chatChannelId: result.channelId || null,
      });
    } catch (err: any) {
      set({ connecting: false, error: err.message || 'Failed to join voice channel' });
    }
  },

  leaveMeeting: async () => {
    const { room, info, sessionToken } = get();
    try {
      if (info?.eventId && sessionToken) {
        await api(`/public/calendar/${info.spaceSlug}/events/${info.eventId}/meeting/leave`, {
          method: 'POST',
          body: JSON.stringify({ sessionToken }),
        });
        localStorage.removeItem(`meeting_session_${info.eventId}`);
      }
    } catch {
      // Best effort
    }
    room?.disconnect();
    set(initialState);
  },

  toggleMute: async () => {
    const { room, localAudioMuted } = get();
    if (!room) return;
    const lp = room.localParticipant;
    if (localAudioMuted) {
      await lp.setMicrophoneEnabled(true);
    } else {
      await lp.setMicrophoneEnabled(false);
    }
    set({ localAudioMuted: !localAudioMuted });
  },

  toggleCamera: async () => {
    const { room, localVideoOff } = get();
    if (!room) return;
    const lp = room.localParticipant;
    if (localVideoOff) {
      await lp.setCameraEnabled(true);
    } else {
      await lp.setCameraEnabled(false);
    }
    set({ localVideoOff: !localVideoOff });
  },

  requestEmailVerification: async (spaceSlug, eventId, email, displayName) => {
    await api(`/public/calendar/${spaceSlug}/events/${eventId}/meeting/verify-email`, {
      method: 'POST',
      body: JSON.stringify({ email, displayName }),
    });
  },

  requestVoiceEmailVerification: async (spaceSlug, channelName, email, displayName) => {
    await api(`/public/${spaceSlug}/voice/${channelName}/meeting/verify-email`, {
      method: 'POST',
      body: JSON.stringify({ email, displayName }),
    });
  },

  reset: () => {
    const { room } = get();
    room?.disconnect();
    set(initialState);
  },
}));

async function connectRoom(token: string, wsUrl: string): Promise<Room> {
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: {
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
    },
    publishDefaults: {
      dtx: false,
      red: false,
      audioPreset: { maxBitrate: 48_000 },
    },
  });

  await room.connect(wsUrl, token);
  return room;
}

function buildParticipant(p: RemoteParticipant | LocalParticipant): GuestParticipant {
  const audioTrack = p.getTrackPublication(Track.Source.Microphone);
  const videoTrack = p.getTrackPublication(Track.Source.Camera);
  const screenTrack = p.getTrackPublication(Track.Source.ScreenShare);

  return {
    identity: p.identity,
    name: p.name || p.identity,
    isSpeaking: p.isSpeaking,
    isMuted: audioTrack ? audioTrack.isMuted || !audioTrack.isSubscribed : true,
    isCameraOff: !videoTrack || videoTrack.isMuted,
    isScreenSharing: !!screenTrack && !screenTrack.isMuted,
  };
}

function refreshParticipants(room: Room, set: any) {
  const participants: GuestParticipant[] = [buildParticipant(room.localParticipant)];
  room.remoteParticipants.forEach((p) => {
    participants.push(buildParticipant(p));
  });
  set({ participants });
}

function setupRoomListeners(room: Room, set: any, get: any) {
  const refresh = () => refreshParticipants(room, set);

  room.on(RoomEvent.ParticipantConnected, refresh);
  room.on(RoomEvent.ParticipantDisconnected, refresh);
  room.on(RoomEvent.TrackMuted, refresh);
  room.on(RoomEvent.TrackUnmuted, refresh);
  room.on(RoomEvent.ActiveSpeakersChanged, refresh);
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === 'audio') {
      const el = track.attach();
      el.id = `remote-audio-${track.sid}`;
      document.body.appendChild(el);
    }
    refresh();
  });
  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    if (track.kind === 'audio') {
      const el = document.getElementById(`remote-audio-${track.sid}`);
      el?.remove();
    }
    refresh();
  });
  room.on(RoomEvent.Disconnected, () => {
    set({ connected: false, room: null, participants: [] });
  });

  refresh();
}
