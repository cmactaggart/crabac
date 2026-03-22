import { useEffect, useState } from 'react';
import { Volume2, Headphones, Mic, MicOff, PhoneOff, ArrowLeft } from 'lucide-react';
import { useCallStore } from '../../stores/call.js';
import { Avatar } from '../common/Avatar.js';
import type { Call, Channel } from '@crabac/shared';

interface Props {
  channelId: string;
  channel: Channel | null;
  onBack?: () => void;
}

export function VoiceChannelView({ channelId, channel, onBack }: Props) {
  const activeVoiceChannelId = useCallStore((s) => s.activeVoiceChannelId);
  const joinVoiceChannel = useCallStore((s) => s.joinVoiceChannel);
  const leaveVoiceChannel = useCallStore((s) => s.leaveVoiceChannel);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const localAudioMuted = useCallStore((s) => s.localAudioMuted);
  const connecting = useCallStore((s) => s.connecting);
  const activeCall = useCallStore((s) => s.activeCall);
  const fetchVoiceChannelCall = useCallStore((s) => s.fetchVoiceChannelCall);

  const [channelCall, setChannelCall] = useState<Call | null>(null);

  const isConnected = activeVoiceChannelId === channelId;

  useEffect(() => {
    fetchVoiceChannelCall(channelId).then(setChannelCall);
  }, [channelId, fetchVoiceChannelCall]);

  useEffect(() => {
    if (isConnected && activeCall) {
      setChannelCall(activeCall);
    }
  }, [isConnected, activeCall]);

  const joinedParticipants = channelCall?.participants.filter(
    (p) => p.status === 'joined',
  ) || [];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        {onBack && (
          <button onClick={onBack} style={styles.backBtn}>
            <ArrowLeft size={20} />
          </button>
        )}
        <Volume2 size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={styles.headerName}>{channel?.displayName || channel?.name || 'Voice Channel'}</span>
      </div>

      {/* Main content */}
      <div style={styles.body}>
        <div style={styles.centerContent}>
          <Volume2 size={48} style={{ color: 'var(--text-muted)' }} />
          <h2 style={styles.title}>{channel?.displayName || channel?.name}</h2>
          {channel?.topic && (
            <p style={styles.topic}>{channel.topic}</p>
          )}

          {/* Participants */}
          {joinedParticipants.length > 0 && (
            <div style={styles.participantSection}>
              <span style={styles.participantLabel}>
                {joinedParticipants.length} connected
              </span>
              <div style={styles.participantGrid}>
                {joinedParticipants.map((p) => (
                  <div key={p.userId} style={styles.participant}>
                    <Avatar src={p.avatarUrl} name={p.displayName} size={36} />
                    <span style={styles.participantName}>{p.displayName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {joinedParticipants.length === 0 && !isConnected && (
            <p style={styles.emptyText}>No one is in this voice channel yet</p>
          )}

          {/* Controls */}
          {isConnected ? (
            <div style={styles.controls}>
              <button
                onClick={toggleMute}
                style={{
                  ...styles.controlBtn,
                  background: localAudioMuted ? 'var(--danger)' : 'var(--bg-tertiary)',
                }}
                title={localAudioMuted ? 'Unmute' : 'Mute'}
              >
                {localAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button
                onClick={leaveVoiceChannel}
                style={{ ...styles.controlBtn, background: 'var(--danger)' }}
                title="Disconnect"
              >
                <PhoneOff size={20} />
              </button>
            </div>
          ) : (
            <button
              onClick={async () => {
                try {
                  await joinVoiceChannel(channelId);
                } catch (err: any) {
                  console.error('Failed to join voice channel:', err);
                  alert(`Failed to join: ${err?.message || JSON.stringify(err)}`);
                }
              }}
              disabled={connecting}
              style={styles.joinBtn}
            >
              <Headphones size={18} />
              {connecting ? 'Connecting...' : 'Join Voice Channel'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    flex: 1,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  headerName: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
  },
  body: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  centerContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    maxWidth: 400,
    textAlign: 'center',
  },
  title: {
    margin: 0,
    fontSize: '1.3rem',
    color: 'var(--text-primary)',
  },
  topic: {
    margin: 0,
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  participantSection: {
    marginTop: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  participantLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  participantGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  participant: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  participantName: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  emptyText: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    marginTop: 8,
  },
  controls: {
    display: 'flex',
    gap: 12,
    marginTop: 20,
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
  },
  joinBtn: {
    marginTop: 20,
    padding: '10px 24px',
    background: 'var(--accent)',
    border: 'none',
    color: '#fff',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
};
