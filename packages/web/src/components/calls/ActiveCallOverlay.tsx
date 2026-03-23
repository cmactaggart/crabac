import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, Maximize2, Minimize2, Pin } from 'lucide-react';
import { Track } from 'livekit-client';
import { useCallStore, type ParticipantState } from '../../stores/call.js';
import { Avatar } from '../common/Avatar.js';

export function ActiveCallOverlay() {
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
  const activeVoiceChannelId = useCallStore((s) => s.activeVoiceChannelId);

  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  if (!activeCall || !room) return null;

  const isVoiceChannel = !!activeVoiceChannelId;

  // Auto-pin screen sharer
  const screenSharer = participants.find((p) => p.isScreenSharing);
  const effectivePinned = screenSharer?.userId || pinnedUserId;
  const pinnedParticipant = effectivePinned ? participants.find((p) => p.userId === effectivePinned) : null;
  const hasVideo = participants.some((p) => !p.isCameraOff || p.isScreenSharing);
  const showPinnedLayout = pinnedParticipant && (pinnedParticipant.isScreenSharing || !pinnedParticipant.isCameraOff);

  const handleToggleFullscreen = () => {
    if (!fullscreen) {
      overlayRef.current?.requestFullscreen?.().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setFullscreen(false);
    }
  };

  // Minimized pill bar at the top
  if (minimized) {
    return (
      <div style={styles.minimizedBar}>
        <div style={styles.minimizedInfo}>
          <span style={styles.liveIndicator} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
            {isVoiceChannel ? 'Voice Channel' : 'In Call'} — {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={styles.minimizedActions}>
          <button onClick={toggleMute} style={styles.miniBtn} title={localAudioMuted ? 'Unmute' : 'Mute'}>
            {localAudioMuted ? <MicOff size={16} color="var(--danger)" /> : <Mic size={16} />}
          </button>
          <button onClick={() => setMinimized(false)} style={styles.miniBtn} title="Expand">
            <Maximize2 size={16} />
          </button>
          <button onClick={leaveCall} style={{ ...styles.miniBtn, color: 'var(--danger)' }} title="Leave">
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
        ...styles.callWindow,
        ...(hasVideo || fullscreen ? styles.callWindowLarge : {}),
        ...(fullscreen ? { width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', borderRadius: 0 } : {}),
      }}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.liveIndicator} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            {isVoiceChannel ? 'Voice Channel' : 'Call'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={handleToggleFullscreen} style={styles.miniBtn} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            <Maximize2 size={16} />
          </button>
          <button onClick={() => setMinimized(true)} style={styles.miniBtn} title="Minimize">
            <Minimize2 size={16} />
          </button>
        </div>

        {/* Pinned layout: main stage + side strip */}
        {showPinnedLayout ? (
          <div style={styles.pinnedLayout}>
            <div style={styles.mainStage}>
              <ParticipantTile
                participant={pinnedParticipant}
                room={room}
                large
                preferScreenShare={pinnedParticipant.isScreenSharing}
              />
              {!screenSharer && (
                <button
                  onClick={() => setPinnedUserId(null)}
                  style={styles.unpinBtn}
                  title="Unpin"
                >
                  <Pin size={14} /> Unpin
                </button>
              )}
            </div>
            {unpinnedParticipants.length > 0 && (
              <div style={styles.sideStrip}>
                {unpinnedParticipants.map((p) => (
                  <div key={p.userId} onClick={() => setPinnedUserId(p.userId)} style={{ cursor: 'pointer' }}>
                    <ParticipantTile participant={p} room={room} small />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Grid layout: all participants equal */
          <div style={styles.participantsGrid}>
            {participants.map((p) => (
              <div key={p.userId} onClick={() => setPinnedUserId(p.userId)} style={{ cursor: 'pointer' }}>
                <ParticipantTile participant={p} room={room} />
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div style={styles.controls}>
          <button
            onClick={toggleMute}
            style={{ ...styles.controlBtn, background: localAudioMuted ? 'var(--danger)' : 'var(--bg-tertiary)' }}
            title={localAudioMuted ? 'Unmute' : 'Mute'}
          >
            {localAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button
            onClick={toggleCamera}
            style={{ ...styles.controlBtn, background: localVideoOff ? 'var(--bg-tertiary)' : 'var(--accent)' }}
            title={localVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {localVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
          <button
            onClick={toggleScreenShare}
            style={{ ...styles.controlBtn, background: isScreenSharing ? 'var(--accent)' : 'var(--bg-tertiary)' }}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
          </button>
          <button onClick={leaveCall} style={{ ...styles.controlBtn, background: 'var(--danger)' }} title="Leave call">
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ParticipantTile({ participant, room, large, small, preferScreenShare }: {
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

  const tileStyle = large
    ? { ...styles.tile, width: '100%', height: '100%' }
    : small
      ? { ...styles.tile, width: 120, height: 90 }
      : styles.tile;

  return (
    <div style={{
      ...tileStyle,
      border: participant.isSpeaking ? '2px solid var(--accent)' : '2px solid transparent',
    }}>
      {hasVideo ? (
        <video
          ref={videoRef}
          style={{ ...styles.video, objectFit: preferScreenShare ? 'contain' : 'cover' }}
          autoPlay
          playsInline
          muted={participant.userId === room?.localParticipant?.identity}
        />
      ) : (
        <div style={styles.avatarCenter}>
          <Avatar src={participant.avatarUrl} name={participant.displayName} size={large ? 64 : small ? 32 : 48} />
        </div>
      )}
      <div style={styles.tileLabel}>
        {participant.isMuted && <MicOff size={12} style={{ color: 'var(--danger)' }} />}
        <span style={{ fontSize: '0.75rem' }}>{participant.displayName}</span>
        {participant.isScreenSharing && <Monitor size={12} style={{ color: 'var(--accent)' }} />}
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
  callWindow: {
    background: 'var(--bg-primary)',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    width: 400,
    maxWidth: '95vw',
    maxHeight: '85vh',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  callWindowLarge: {
    width: 860,
    height: '80vh',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
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
  pinnedLayout: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0,
  },
  mainStage: {
    flex: 1,
    position: 'relative',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
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
    width: 140,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 4,
    overflowY: 'auto',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  participantsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
    flex: 1,
    overflow: 'auto',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  tile: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    background: 'var(--bg-secondary)',
    width: 160,
    height: 120,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  tileLabel: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: '#fff',
    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
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
