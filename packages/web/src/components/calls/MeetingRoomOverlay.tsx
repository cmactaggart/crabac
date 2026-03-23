import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, Minimize2, Maximize2, Pin } from 'lucide-react';
import { Track } from 'livekit-client';
import { useCallStore, type ParticipantState } from '../../stores/call.js';
import { useAuthStore } from '../../stores/auth.js';
import { getSocket } from '../../lib/socket.js';
import { api } from '../../lib/api.js';
import { Avatar } from '../common/Avatar.js';
import { MessageList } from '../messages/MessageList.js';
import { MessageInput } from '../messages/MessageInput.js';
import type { Message, Reaction, LinkEmbed } from '@crabac/shared';

export function MeetingRoomOverlay() {
  const activeCall = useCallStore((s) => s.activeCall);
  const room = useCallStore((s) => s.room);
  const participants = useCallStore((s) => s.participants);
  const localAudioMuted = useCallStore((s) => s.localAudioMuted);
  const localVideoOff = useCallStore((s) => s.localVideoOff);
  const isScreenSharing = useCallStore((s) => s.isScreenSharing);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const toggleCamera = useCallStore((s) => s.toggleCamera);
  const toggleScreenShare = useCallStore((s) => s.toggleScreenShare);
  const leaveCall = useCallStore((s) => s.leaveCall);
  const activeEventId = useCallStore((s) => s.activeEventId);
  const activeEventChannelId = useCallStore((s) => s.activeEventChannelId);
  const activeEventSpaceId = useCallStore((s) => s.activeEventSpaceId);
  const activeEventName = useCallStore((s) => s.activeEventName);

  const user = useAuthStore((s) => s.user);

  // Local message state for the meeting room chat (separate from global messages store)
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const channelJoinedRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Fetch messages for the temp channel (use API directly to avoid polluting global messages store)
  useEffect(() => {
    if (!activeEventChannelId) return;
    setLoading(true);
    api<Message[]>(`/channels/${activeEventChannelId}/messages?limit=50`).then((msgs) => {
      setMessages(msgs);
      setHasMore(msgs.length === 50);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [activeEventChannelId]);

  // Join/leave channel socket room + listen for new messages
  useEffect(() => {
    if (!activeEventChannelId) return;

    const socket = getSocket();
    if (!socket) return;

    socket.emit('channel:join', { channelId: activeEventChannelId });
    channelJoinedRef.current = true;

    const onNew = (message: Message) => {
      if (message.channelId === activeEventChannelId) {
        setMessages((prev) => prev.some((m) => m.id === message.id) ? prev : [...prev, message]);
      }
    };

    const onUpdated = (message: Message) => {
      if (message.channelId === activeEventChannelId) {
        setMessages((prev) => prev.map((m) => m.id === message.id ? message : m));
      }
    };

    const onDeleted = (payload: { channelId: string; messageId: string }) => {
      if (payload.channelId === activeEventChannelId) {
        setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
      }
    };

    const onReactionsUpdated = (payload: { channelId: string; messageId: string; reactions: Reaction[] }) => {
      if (payload.channelId === activeEventChannelId) {
        setMessages((prev) => prev.map((m) => m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m));
      }
    };

    const onEmbedsReady = (payload: { channelId: string; messageId: string; embeds: LinkEmbed[] }) => {
      if (payload.channelId === activeEventChannelId) {
        setMessages((prev) => prev.map((m) => m.id === payload.messageId ? { ...m, embeds: payload.embeds } : m));
      }
    };

    const onReconnect = () => {
      socket.emit('channel:join', { channelId: activeEventChannelId });
    };

    socket.on('connect', onReconnect);
    socket.on('message:new', onNew);
    socket.on('message:updated', onUpdated);
    socket.on('message:deleted', onDeleted);
    socket.on('message:reactions_updated', onReactionsUpdated);
    socket.on('message:embeds_ready', onEmbedsReady);

    return () => {
      socket.emit('channel:leave', { channelId: activeEventChannelId });
      channelJoinedRef.current = false;
      socket.off('connect', onReconnect);
      socket.off('message:new', onNew);
      socket.off('message:updated', onUpdated);
      socket.off('message:deleted', onDeleted);
      socket.off('message:reactions_updated', onReactionsUpdated);
      socket.off('message:embeds_ready', onEmbedsReady);
    };
  }, [activeEventChannelId]);

  const handleToggleFullscreen = useCallback(() => {
    if (!fullscreen) {
      overlayRef.current?.requestFullscreen?.().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setFullscreen(false);
    }
  }, [fullscreen]);

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Auto-pin screen sharer
  const screenSharer = participants.find((p) => p.isScreenSharing);
  const effectivePinned = screenSharer?.userId || pinnedUserId;
  const pinnedParticipant = effectivePinned ? participants.find((p) => p.userId === effectivePinned) : null;
  const hasVideo = participants.some((p) => !p.isCameraOff || p.isScreenSharing);
  const showPinnedLayout = pinnedParticipant && (pinnedParticipant.isScreenSharing || !pinnedParticipant.isCameraOff);

  const handleSend = useCallback(async (content: string, replyToId?: string) => {
    if (!activeEventChannelId) return;
    const message = await api<Message>(`/channels/${activeEventChannelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, replyToId }),
    });
    // Add immediately; socket event will dedup via id check
    setMessages((prev) => prev.some((m) => m.id === message.id) ? prev : [...prev, message]);
  }, [activeEventChannelId]);

  const handleReply = useCallback((message: Message) => {
    setReplyingTo(message);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleUserClick = useCallback(() => {}, []);

  const handleLeave = useCallback(async () => {
    await leaveCall();
  }, [leaveCall]);

  if (!activeCall || !room || !activeEventId) return null;

  if (minimized) {
    return (
      <div style={styles.minimizedBar}>
        <div style={styles.minimizedInfo}>
          <span style={styles.liveIndicator} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
            {activeEventName || 'Meeting Room'} — {participants.length}
          </span>
        </div>
        <div style={styles.minimizedActions}>
          <button onClick={toggleMute} style={styles.miniBtn} title={localAudioMuted ? 'Unmute' : 'Mute'}>
            {localAudioMuted ? <MicOff size={16} color="var(--danger)" /> : <Mic size={16} />}
          </button>
          <button onClick={() => setMinimized(false)} style={styles.miniBtn} title="Expand">
            <Maximize2 size={16} />
          </button>
          <button onClick={handleLeave} style={{ ...styles.miniBtn, color: 'var(--danger)' }} title="Leave">
            <PhoneOff size={16} />
          </button>
        </div>
      </div>
    );
  }

  const unpinnedParticipants = showPinnedLayout
    ? participants.filter((p) => p.userId !== effectivePinned)
    : [];

  return (
    <div style={styles.overlay} ref={overlayRef}>
      <div style={{
        ...styles.meetingWindow,
        ...(fullscreen ? { width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', borderRadius: 0 } : {}),
      }}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.liveIndicator} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeEventName || 'Meeting Room'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
          <button onClick={handleToggleFullscreen} style={styles.miniBtn} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            <Maximize2 size={16} />
          </button>
          <button onClick={() => setMinimized(true)} style={styles.miniBtn} title="Minimize">
            <Minimize2 size={16} />
          </button>
        </div>

        {/* Voice section: pinned layout or participant grid + controls */}
        <div style={{ ...styles.voiceSection, ...(hasVideo || showPinnedLayout ? { flex: fullscreen ? 1 : undefined, minHeight: hasVideo ? 200 : undefined } : {}) }}>
          {showPinnedLayout ? (
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <div style={styles.mainStage}>
                <MeetingParticipantTile participant={pinnedParticipant} room={room} large preferScreenShare={pinnedParticipant.isScreenSharing} />
                {!screenSharer && (
                  <button onClick={() => setPinnedUserId(null)} style={styles.unpinBtn} title="Unpin">
                    <Pin size={14} /> Unpin
                  </button>
                )}
              </div>
              {unpinnedParticipants.length > 0 && (
                <div style={styles.sideStrip}>
                  {unpinnedParticipants.map((p) => (
                    <div key={p.userId} onClick={() => setPinnedUserId(p.userId)} style={{ cursor: 'pointer' }}>
                      <MeetingParticipantTile participant={p} room={room} small />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={styles.participantRow}>
              {participants.map((p) => (
                <div key={p.userId} onClick={() => setPinnedUserId(p.userId)} style={{ cursor: 'pointer' }}>
                  {hasVideo ? (
                    <MeetingParticipantTile participant={p} room={room} />
                  ) : (
                    <div style={{
                      ...styles.participantChip,
                      border: p.isSpeaking ? '2px solid var(--accent)' : '2px solid transparent',
                    }}>
                      <Avatar src={p.avatarUrl} name={p.displayName} size={28} />
                      {p.isMuted && <MicOff size={10} style={{ position: 'absolute', bottom: -1, right: -1, color: 'var(--danger)', background: 'var(--bg-primary)', borderRadius: '50%', padding: 1 }} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div style={styles.controls}>
            <button onClick={toggleMute} style={{ ...styles.controlBtn, background: localAudioMuted ? 'var(--danger)' : 'var(--bg-tertiary)' }} title={localAudioMuted ? 'Unmute' : 'Mute'}>
              {localAudioMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button onClick={toggleCamera} style={{ ...styles.controlBtn, background: localVideoOff ? 'var(--bg-tertiary)' : 'var(--accent)' }} title={localVideoOff ? 'Turn on camera' : 'Turn off camera'}>
              {localVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
            </button>
            <button onClick={toggleScreenShare} style={{ ...styles.controlBtn, background: isScreenSharing ? 'var(--accent)' : 'var(--bg-tertiary)' }} title={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
              {isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
            </button>
            <button onClick={handleLeave} style={{ ...styles.controlBtn, background: 'var(--danger)' }} title="Leave meeting">
              <PhoneOff size={18} />
            </button>
          </div>
        </div>

        {/* Chat section */}
        {activeEventChannelId && activeEventSpaceId && user ? (
          <div style={styles.chatSection}>
            <div style={styles.messageListContainer}>
              <MessageList
                messages={messages}
                loading={loading}
                hasMore={hasMore}
                currentUserId={user.id}
                channelId={activeEventChannelId}
                spaceId={activeEventSpaceId}
                onReply={handleReply}
                onUserClick={handleUserClick}
              />
            </div>
            <div style={styles.messageInputContainer}>
              <MessageInput
                channelId={activeEventChannelId}
                spaceId={activeEventSpaceId}
                onSend={handleSend}
                replyingTo={replyingTo}
                onCancelReply={handleCancelReply}
              />
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Chat unavailable
          </div>
        )}
      </div>
    </div>
  );
}

function MeetingParticipantTile({ participant, room, large, small, preferScreenShare }: {
  participant: ParticipantState;
  room: any;
  large?: boolean;
  small?: boolean;
  preferScreenShare?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = !participant.isCameraOff || participant.isScreenSharing;

  useEffect(() => {
    if (!videoRef.current || !hasVideo || !room) return;

    const lkParticipant = participant.userId === room.localParticipant.identity
      ? room.localParticipant
      : room.remoteParticipants.get(participant.userId);

    if (!lkParticipant) return;

    const source = (preferScreenShare && participant.isScreenSharing) ? Track.Source.ScreenShare :
                   participant.isScreenSharing ? Track.Source.ScreenShare : Track.Source.Camera;
    const pub = lkParticipant.getTrackPublication(source);
    const track = pub?.track;

    if (track) {
      track.attach(videoRef.current);
    }

    return () => {
      if (track && videoRef.current) {
        track.detach(videoRef.current);
      }
    };
  }, [hasVideo, participant.userId, participant.isScreenSharing, participant.isCameraOff, room, preferScreenShare]);

  const w = large ? '100%' : small ? 120 : 140;
  const h = large ? '100%' : small ? 90 : 105;

  return (
    <div style={{
      position: 'relative',
      borderRadius: 8,
      overflow: 'hidden',
      background: 'var(--bg-secondary)',
      width: w,
      height: h,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      border: participant.isSpeaking ? '2px solid var(--accent)' : '2px solid transparent',
    }}>
      {hasVideo ? (
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: preferScreenShare ? 'contain' : 'cover' }}
          autoPlay
          playsInline
          muted={participant.userId === room?.localParticipant?.identity}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
          <Avatar src={participant.avatarUrl} name={participant.displayName} size={large ? 64 : small ? 28 : 36} />
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 3, left: 3, right: 3, display: 'flex', alignItems: 'center', gap: 3, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
        {participant.isMuted && <MicOff size={10} style={{ color: 'var(--danger)' }} />}
        <span style={{ fontSize: '0.65rem' }}>{participant.displayName}</span>
        {participant.isScreenSharing && <Monitor size={10} style={{ color: 'var(--accent)' }} />}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  meetingWindow: {
    background: 'var(--bg-primary)',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    width: 800,
    height: 600,
    maxWidth: '95vw',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--success)',
    flexShrink: 0,
  },
  voiceSection: {
    padding: '8px 16px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flexShrink: 0,
  },
  mainStage: {
    flex: 1,
    position: 'relative',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    minHeight: 160,
  },
  unpinBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'rgba(0,0,0,0.6)',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  sideStrip: {
    width: 130,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 4,
    overflowY: 'auto',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  participantRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    overflow: 'auto',
    flexWrap: 'wrap',
  },
  participantChip: {
    position: 'relative',
    borderRadius: '50%',
    flexShrink: 0,
  },
  controls: {
    display: 'flex',
    gap: 8,
    flexShrink: 0,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
  },
  chatSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  messageListContainer: {
    flex: 1,
    overflow: 'auto',
  },
  messageInputContainer: {
    flexShrink: 0,
    borderTop: '1px solid var(--border)',
  },
  minimizedBar: {
    position: 'fixed',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderTop: 'none',
    borderRadius: '0 0 12px 12px',
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    zIndex: 9998,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  minimizedInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  minimizedActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  miniBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    borderRadius: 4,
  },
};
