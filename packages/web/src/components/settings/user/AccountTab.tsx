import { useState } from 'react';
import { useAuthStore } from '../../../stores/auth.js';
import { api } from '../../../lib/api.js';

interface Props {
  onClose: () => void;
}

export function AccountTab({ onClose }: Props) {
  const logout = useAuthStore((s) => s.logout);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const handleDelete = async () => {
    setError('');
    setDeleting(true);
    try {
      await api('/users/me', {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      });
      await logout();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Sign Out */}
      <div>
        <label style={styles.label}>Session</label>
        <div style={{ marginTop: 8 }}>
          <button onClick={handleLogout} style={styles.dangerBtn}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div>
        <label style={styles.label}>Danger Zone</label>
        <div style={styles.dangerZone}>
          {!showConfirm ? (
            <button onClick={() => setShowConfirm(true)} style={styles.deleteTrigger}>
              Delete Account
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                This action is permanent. Enter your password to confirm.
              </div>
              {error && <div style={styles.error}>{error}</div>}
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => { setShowConfirm(false); setPassword(''); setError(''); }}
                  style={styles.cancelBtn}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  style={styles.confirmDeleteBtn}
                  disabled={deleting || !password}
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  label: {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  },
  dangerBtn: {
    padding: '0.55rem 1.25rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--danger)',
    background: 'transparent',
    color: 'var(--danger)',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  dangerZone: {
    marginTop: 8,
    padding: '0.75rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--danger)',
    background: 'rgba(237, 66, 69, 0.05)',
  },
  deleteTrigger: {
    padding: '0.55rem 1.25rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--danger)',
    background: 'transparent',
    color: 'var(--danger)',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  input: {
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
  },
  cancelBtn: {
    flex: 1,
    padding: '0.5rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  confirmDeleteBtn: {
    flex: 1,
    padding: '0.5rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--danger)',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
};
