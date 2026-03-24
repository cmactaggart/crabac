import { useEffect } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useCallStore } from '../../stores/call.js';
import { Avatar } from '../common/Avatar.js';

const RINGING_TIMEOUT_MS = 60_000; // 60 seconds — matches server timeout

export function IncomingCallModal() {
  const incomingCall = useCallStore((s) => s.incomingCall);
  const acceptCall = useCallStore((s) => s.acceptCall);
  const declineCall = useCallStore((s) => s.declineCall);
  const dismissIncoming = useCallStore((s) => s.dismissIncoming);
  const connecting = useCallStore((s) => s.connecting);

  // Auto-dismiss after timeout
  useEffect(() => {
    if (!incomingCall) return;
    const timer = setTimeout(() => {
      dismissIncoming();
    }, RINGING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [incomingCall?.id, dismissIncoming]);

  if (!incomingCall) return null;

  const caller = incomingCall.participants.find(
    (p) => p.userId === incomingCall.initiatedBy,
  );
  const callerName = caller?.displayName || caller?.username || 'Someone';

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <Avatar
          src={caller?.avatarUrl || null}
          name={callerName}
          size={64}
        />
        <div style={styles.callerName}>{callerName}</div>
        <div style={styles.callLabel}>Incoming call...</div>
        <div style={styles.actions}>
          <button
            onClick={() => declineCall(incomingCall.id)}
            style={{ ...styles.actionBtn, background: 'var(--danger)' }}
            title="Decline"
          >
            <PhoneOff size={24} />
          </button>
          <button
            onClick={() => acceptCall(incomingCall.id).catch((err: any) => {
              alert(`Failed to connect: ${err?.message || 'Connection error'}`);
            })}
            disabled={connecting}
            style={{ ...styles.actionBtn, background: 'var(--success)' }}
            title="Accept"
          >
            <Phone size={24} />
          </button>
        </div>
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
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    background: 'var(--bg-primary)',
    borderRadius: 16,
    padding: '32px 40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    minWidth: 280,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  callerName: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  callLabel: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginBottom: 8,
  },
  actions: {
    display: 'flex',
    gap: 24,
  },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.15s',
  },
};
