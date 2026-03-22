import { useEffect, useState } from 'react';
import { Headphones, Mic, MicOff, PhoneOff } from 'lucide-react';
import { useCallStore } from '../../stores/call.js';
import { Avatar } from '../common/Avatar.js';
import type { Call, CallParticipant } from '@crabac/shared';

interface Props {
  channelId: string;
  channelName: string;
}

/**
 * Panel shown below a voice channel in the sidebar.
 * Shows current participants and join/leave controls.
 */
export function VoiceChannelPanel({ channelId, channelName }: Props) {
  const activeVoiceChannelId = useCallStore((s) => s.activeVoiceChannelId);
  const joinVoiceChannel = useCallStore((s) => s.joinVoiceChannel);
  const leaveVoiceChannel = useCallStore((s) => s.leaveVoiceChannel);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const localAudioMuted = useCallStore((s) => s.localAudioMuted);
  const connecting = useCallStore((s) => s.connecting);
  const fetchVoiceChannelCall = useCallStore((s) => s.fetchVoiceChannelCall);
  const activeCall = useCallStore((s) => s.activeCall);

  const [channelCall, setChannelCall] = useState<Call | null>(null);

  const isInThisChannel = activeVoiceChannelId === channelId;

  // Fetch current participants for this voice channel
  useEffect(() => {
    fetchVoiceChannelCall(channelId).then(setChannelCall);
  }, [channelId, fetchVoiceChannelCall]);

  // Refresh when our active call updates (someone joined/left)
  useEffect(() => {
    if (isInThisChannel && activeCall) {
      setChannelCall(activeCall);
    }
  }, [isInThisChannel, activeCall]);

  const joinedParticipants = channelCall?.participants.filter(
    (p) => p.status === 'joined',
  ) || [];

  return (
    <div style={styles.panel}>
      {/* Show participants currently in the channel */}
      {joinedParticipants.length > 0 && (
        <div style={styles.participantList}>
          {joinedParticipants.map((p) => (
            <div key={p.userId} style={styles.participant}>
              <Avatar src={p.avatarUrl} name={p.displayName} size={20} />
              <span style={styles.participantName}>{p.displayName}</span>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      {isInThisChannel ? (
        <div style={styles.connectedControls}>
          <div style={styles.connectedLabel}>
            <Headphones size={14} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Connected</span>
          </div>
          <div style={styles.connectedActions}>
            <button
              onClick={toggleMute}
              style={{
                ...styles.smallBtn,
                color: localAudioMuted ? 'var(--danger)' : 'var(--text-secondary)',
              }}
              title={localAudioMuted ? 'Unmute' : 'Mute'}
            >
              {localAudioMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              onClick={leaveVoiceChannel}
              style={{ ...styles.smallBtn, color: 'var(--danger)' }}
              title="Disconnect"
            >
              <PhoneOff size={16} />
            </button>
          </div>
        </div>
      ) : (
        joinedParticipants.length > 0 && (
          <button
            onClick={() => joinVoiceChannel(channelId)}
            disabled={connecting}
            style={styles.joinBtn}
          >
            <Headphones size={14} />
            Join
          </button>
        )
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    padding: '2px 8px 4px 28px',
  },
  participantList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  participant: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 4px',
    borderRadius: 4,
  },
  participantName: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  connectedControls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  connectedLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  connectedActions: {
    display: 'flex',
    gap: 4,
  },
  smallBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    borderRadius: 4,
  },
  joinBtn: {
    marginTop: 4,
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '3px 8px',
    borderRadius: 4,
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    justifyContent: 'center',
  },
};
