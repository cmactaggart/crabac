import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, Mail, Lock } from 'lucide-react';
import { Track } from 'livekit-client';
import { usePublicMeetingStore } from '../../stores/publicMeeting.js';
import type { GuestParticipant } from '../../stores/publicMeeting.js';

type Phase = 'loading' | 'pre-join' | 'email-verify' | 'in-channel' | 'error';

export function PublicVoiceChannel() {
  const { spaceSlug, channelName } = useParams();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') || undefined;
  const emailVerifyToken = searchParams.get('token') || undefined;

  const {
    info, room, connected, connecting, error,
    participants, localAudioMuted, localVideoOff,
    fetchVoiceChannelInfo, joinVoiceChannel, leaveMeeting, toggleMute, toggleCamera,
    requestVoiceEmailVerification, reset,
  } = usePublicMeetingStore();

  const [phase, setPhase] = useState<Phase>('loading');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (!spaceSlug || !channelName) return;
    fetchVoiceChannelInfo(spaceSlug, channelName).then(() => setPhase('pre-join'));
    return () => reset();
  }, [spaceSlug, channelName]);

  useEffect(() => {
    if (error && phase === 'loading') setPhase('error');
  }, [error]);

  useEffect(() => {
    if (connected) setPhase('in-channel');
  }, [connected]);

  const handleJoin = async () => {
    if (!spaceSlug || !channelName || !displayName.trim()) return;
    setJoinError('');

    if (info?.identityMode === 'email_verify' && !emailVerifyToken) {
      setPhase('email-verify');
      return;
    }

    try {
      await joinVoiceChannel(spaceSlug, channelName, {
        displayName: displayName.trim(),
        password: password || undefined,
        inviteToken,
        emailVerificationToken: emailVerifyToken,
      });
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join');
    }
  };

  const handleSendVerification = async () => {
    if (!spaceSlug || !channelName || !email || !displayName.trim()) return;
    try {
      await requestVoiceEmailVerification(spaceSlug, channelName, email, displayName.trim());
      setEmailSent(true);
    } catch (err: any) {
      setJoinError(err.message || 'Failed to send verification email');
    }
  };

  if (phase === 'loading') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ color: 'var(--text-secondary)' }}>Loading channel...</div>
        </div>
      </div>
    );
  }

  if (phase === 'error' || !info) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>Channel Not Found</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{error || 'This voice channel is not available.'}</p>
        </div>
      </div>
    );
  }

  if (phase === 'email-verify') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <Mail size={32} style={{ color: 'var(--accent)', marginBottom: 12 }} />
          <h2 style={styles.title}>Email Verification Required</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
            Enter your email to receive a verification link.
          </p>
          {emailSent ? (
            <p style={{ color: 'var(--accent)' }}>Check your email for the verification link!</p>
          ) : (
            <>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={styles.input}
              />
              {joinError && <p style={styles.error}>{joinError}</p>}
              <button onClick={handleSendVerification} disabled={!email} style={styles.primaryBtn}>
                Send Verification Email
              </button>
            </>
          )}
          <button onClick={() => setPhase('pre-join')} style={styles.secondaryBtn}>Back</button>
        </div>
      </div>
    );
  }

  if (phase === 'in-channel' && room) {
    return <InChannelView />;
  }

  // Pre-join screen
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>{info.name}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 12 }}>{info.spaceName}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
          <Users size={14} />
          <span>{info.participantCount} in channel</span>
        </div>

        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your display name"
          style={styles.input}
          maxLength={100}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        />

        {info.hasPassword && !inviteToken && (
          <div style={{ position: 'relative' }}>
            <Lock size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Channel password"
              style={{ ...styles.input, paddingLeft: 32 }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>
        )}

        {info.identityMode === 'require_login' && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 8 }}>
            This channel requires you to be logged in.
          </p>
        )}

        {(joinError || error) && <p style={styles.error}>{joinError || error}</p>}

        <button
          onClick={handleJoin}
          disabled={connecting || !displayName.trim()}
          style={styles.primaryBtn}
        >
          {connecting ? 'Joining...' : 'Join Channel'}
        </button>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
          {info.publicParticipation ? 'You can use your mic and camera' : 'Listen-only mode'}
          {info.publicChat ? ' with chat' : ''}
        </div>
      </div>
    </div>
  );
}

function InChannelView() {
  const {
    info, room, participants, localAudioMuted, localVideoOff,
    toggleMute, toggleCamera, leaveMeeting,
  } = usePublicMeetingStore();

  if (!room || !info) return null;

  return (
    <div style={styles.meetingContainer}>
      <div style={styles.meetingHeader}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{info.name}</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{info.spaceName}</span>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{participants.length} participants</span>
      </div>

      <div style={styles.videoGrid}>
        {participants.map((p) => (
          <ParticipantTile key={p.identity} participant={p} isLocal={p.identity === room.localParticipant.identity} />
        ))}
      </div>

      <div style={styles.controls}>
        {info.publicParticipation && (
          <>
            <button onClick={toggleMute} style={{ ...styles.controlBtn, background: localAudioMuted ? 'var(--danger)' : 'var(--bg-tertiary)' }}>
              {localAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <button onClick={toggleCamera} style={{ ...styles.controlBtn, background: localVideoOff ? 'var(--danger)' : 'var(--bg-tertiary)' }}>
              {localVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
            </button>
          </>
        )}
        <button onClick={leaveMeeting} style={{ ...styles.controlBtn, background: 'var(--danger)' }}>
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}

function ParticipantTile({ participant, isLocal }: { participant: GuestParticipant; isLocal: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const room = usePublicMeetingStore((s) => s.room);

  useEffect(() => {
    if (!room || !videoRef.current) return;
    const lkParticipant = isLocal
      ? room.localParticipant
      : room.remoteParticipants.get(participant.identity);
    if (!lkParticipant) return;

    const videoTrack = lkParticipant.getTrackPublication(Track.Source.Camera);
    if (videoTrack?.track) {
      videoTrack.track.attach(videoRef.current);
      return () => { videoTrack.track?.detach(videoRef.current!); };
    }
  }, [participant.identity, participant.isCameraOff, isLocal, room]);

  return (
    <div style={{
      ...styles.tile,
      border: participant.isSpeaking ? '2px solid var(--accent)' : '2px solid transparent',
    }}>
      {participant.isCameraOff ? (
        <div style={styles.avatar}>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {participant.name.charAt(0).toUpperCase()}
          </span>
        </div>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted={isLocal} style={styles.video} />
      )}
      <div style={styles.tileName}>
        <span>{participant.name}{isLocal ? ' (you)' : ''}</span>
        {participant.isMuted && <MicOff size={12} />}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    padding: 20,
  },
  card: {
    background: 'var(--bg-secondary)',
    borderRadius: 12,
    padding: 32,
    maxWidth: 420,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '1.3rem',
    color: 'var(--text-primary)',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    marginBottom: 10,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  primaryBtn: {
    padding: '10px 20px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    marginTop: 4,
  },
  secondaryBtn: {
    padding: '8px 16px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.85rem',
    marginTop: 8,
  },
  error: {
    color: 'var(--danger)',
    fontSize: '0.85rem',
    marginBottom: 8,
  },
  meetingContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--bg-primary)',
  },
  meetingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  videoGrid: {
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    justifyContent: 'center',
    alignContent: 'center',
    overflow: 'auto',
  },
  tile: {
    position: 'relative',
    width: 280,
    height: 210,
    borderRadius: 8,
    overflow: 'hidden',
    background: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  tileName: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '4px 8px',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    padding: '16px 20px',
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#fff',
  },
};
