export type CallType = 'dm' | 'voice_channel';
export type CallStatus = 'ringing' | 'active' | 'ended';
export type CallParticipantStatus = 'ringing' | 'joined' | 'declined' | 'left' | 'missed';

export interface Call {
  id: string;
  type: CallType;
  conversationId: string | null;
  channelId: string | null;
  spaceId: string | null;
  roomName: string;
  initiatedBy: string;
  status: CallStatus;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  participants: CallParticipant[];
}

export interface CallParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  baseColor: string | null;
  accentColor: string | null;
  status: CallParticipantStatus;
  joinedAt: string | null;
  leftAt: string | null;
}

export interface CallToken {
  token: string;
  wsUrl: string;
}
