import { useEffect, useState } from 'react';
import { X, Zap, Send } from 'lucide-react';
import { usePortalsStore } from '../../stores/portals.js';

interface Props {
  channelId: string;
  sourceSpaceId: string;
  onClose: () => void;
}

export function CreatePortalModal({ channelId, sourceSpaceId, onClose }: Props) {
  const { eligibleSpaces, loading, error, fetchEligibleSpaces, createPortal, submitPortalInvite } = usePortalsStore();
  const [status, setStatus] = useState<'idle' | 'creating' | 'success' | 'invited' | 'error'>('idle');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    fetchEligibleSpaces(channelId);
  }, [channelId, fetchEligibleSpaces]);

  const handleCreateDirectly = async (targetSpaceId: string) => {
    setStatus('creating');
    setActionError('');
    try {
      await createPortal(sourceSpaceId, channelId, targetSpaceId);
      setStatus('success');
    } catch (err: any) {
      setActionError(err.message || 'Failed to create portal');
      setStatus('error');
    }
  };

  const handleRequestPortal = async (targetSpaceId: string) => {
    setStatus('creating');
    setActionError('');
    try {
      await submitPortalInvite(sourceSpaceId, channelId, targetSpaceId);
      setStatus('invited');
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit portal invite');
      setStatus('error');
    }
  };

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Create Portal</h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        {status === 'success' && (
          <div style={styles.body}>
            <div style={styles.successMsg}>
              <Zap size={20} /> Portal created successfully!
            </div>
            <button onClick={onClose} style={styles.doneBtn}>Done</button>
          </div>
        )}

        {status === 'invited' && (
          <div style={styles.body}>
            <div style={styles.successMsg}>
              <Send size={20} /> Portal invite submitted! An admin in the target space will need to approve it.
            </div>
            <button onClick={onClose} style={styles.doneBtn}>Done</button>
          </div>
        )}

        {(status === 'idle' || status === 'error') && (
          <div style={styles.body}>
            {actionError && <div style={styles.error}>{actionError}</div>}
            {error && <div style={styles.error}>{error}</div>}

            {loading && <div style={{ color: 'var(--text-muted)', padding: 16 }}>Loading spaces...</div>}

            {!loading && eligibleSpaces.length === 0 && (
              <div style={{ color: 'var(--text-muted)', padding: 16 }}>
                No eligible spaces found. You need CREATE_PORTAL or SUBMIT_PORTAL_INVITE permission in another space.
              </div>
            )}

            {!loading && eligibleSpaces.map((space) => (
              <div key={space.id} style={styles.spaceRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{space.name}</div>
                </div>
                {space.canCreateDirectly ? (
                  <button
                    onClick={() => handleCreateDirectly(space.id)}
                    style={styles.createBtn}
                  >
                    <Zap size={14} /> Create Directly
                  </button>
                ) : space.canSubmitInvite ? (
                  <button
                    onClick={() => handleRequestPortal(space.id)}
                    style={styles.requestBtn}
                  >
                    <Send size={14} /> Request Portal
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {status === 'creating' && (
          <div style={styles.body}>
            <div style={{ color: 'var(--text-muted)', padding: 16 }}>Creating portal...</div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    width: 420,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
  },
  body: {
    padding: '12px 16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  spaceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
  },
  createBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  requestBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  successMsg: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--success, #43b581)',
    fontSize: '0.95rem',
    padding: '12px 0',
  },
  doneBtn: {
    padding: '8px 16px',
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    alignSelf: 'flex-end',
  },
};
