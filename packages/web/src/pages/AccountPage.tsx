import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '../stores/auth.js';
import { MfaSetup, MfaDisable } from './MfaSetup.js';
import { api } from '../lib/api.js';

export function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [showMfa, setShowMfa] = useState(false);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Account</h2>
        <button onClick={logout} style={styles.logoutBtn}>Sign out</button>
      </div>

      <div style={styles.body}>
        <div style={styles.settingsRow}>
          <div>
            <div style={{ fontWeight: 600 }}>{user?.displayName}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>@{user?.username}</div>
          </div>
        </div>

        <div style={styles.settingsRow}>
          <div>
            <div style={{ fontWeight: 600 }}>{user?.email}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {user?.emailVerified ? 'Verified' : 'Not verified'}
            </div>
          </div>
        </div>

        <div style={styles.settingsRow}>
          <div>
            <div style={{ fontWeight: 600 }}>Two-Factor Authentication</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {user?.totpEnabled ? 'Enabled' : 'Not enabled'}
            </div>
          </div>
          <button onClick={() => setShowMfa(true)} style={styles.smallBtn}>
            {user?.totpEnabled ? 'Manage' : 'Set up'}
          </button>
        </div>
      </div>

      {showMfa && <MfaModal user={user} onClose={() => setShowMfa(false)} />}
    </div>
  );
}

function MfaModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [done, setDone] = useState(false);

  const handleComplete = () => {
    setDone(true);
    api('/users/me').then((u) => useAuthStore.setState({ user: u }));
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={styles.modal}>
        {user?.totpEnabled ? (
          done ? (
            <div style={{ textAlign: 'center' }}>
              <h3>MFA Disabled</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Two-factor authentication has been removed.</p>
              <button onClick={onClose} style={styles.primaryBtn}>Close</button>
            </div>
          ) : (
            <MfaDisable onComplete={handleComplete} />
          )
        ) : (
          <MfaSetup onComplete={handleComplete} />
        )}
        <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    paddingBottom: 56,
    background: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 700,
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '0.3rem 0.7rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflowY: 'auto',
  },
  settingsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-secondary)',
  },
  smallBtn: {
    padding: '0.35rem 0.75rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
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
    background: 'var(--bg-secondary)',
    padding: '2rem',
    borderRadius: 'var(--radius)',
    width: '100%',
    maxWidth: '440px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '1.5rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  primaryBtn: {
    padding: '0.65rem 1rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
