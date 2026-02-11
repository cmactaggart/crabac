import { useState, useRef } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.js';
import { getSocket } from '../../lib/socket.js';
import { Avatar } from './Avatar.js';

interface Props {
  onClose: () => void;
}

export function UserSettingsModal({ onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar);
  const setStatus = useAuthStore((s) => s.setStatus);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!displayName.trim() || saving) return;
    setSaving(true);
    try {
      await updateProfile({ displayName: displayName.trim() });
      onClose();
    } catch {
      // keep modal open
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadAvatar(file);
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ margin: 0 }}>User Settings</h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        <div style={styles.body}>
          {/* Avatar */}
          <div style={styles.avatarSection}>
            <Avatar src={user?.avatarUrl || null} name={user?.displayName || '?'} size={80} />
            <button
              onClick={() => fileRef.current?.click()}
              style={styles.uploadBtn}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Change Avatar'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* Status selector */}
          <div style={styles.field}>
            <label style={styles.label}>Status</label>
            <div style={styles.statusRow}>
              {([
                { value: 'online', label: 'Online', color: 'var(--success)' },
                { value: 'idle', label: 'Idle', color: '#faa61a' },
                { value: 'dnd', label: 'Do Not Disturb', color: 'var(--danger)' },
                { value: 'offline', label: 'Invisible', color: 'var(--text-muted)' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    const isOverride = opt.value === 'dnd' || opt.value === 'offline';
                    if (isOverride) {
                      localStorage.setItem('presenceOverride', opt.value);
                    } else {
                      localStorage.removeItem('presenceOverride');
                    }
                    setStatus(opt.value);
                    getSocket()?.emit('presence:status', { status: opt.value });
                  }}
                  style={{
                    ...styles.statusBtn,
                    borderColor: user?.status === opt.value ? 'var(--accent)' : 'var(--border)',
                    background: user?.status === opt.value ? 'var(--bg-tertiary)' : 'transparent',
                  }}
                >
                  <span style={{ ...styles.dot, background: opt.color }} />
                  <span style={{ fontSize: '0.8rem' }}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Profile fields */}
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input value={user?.username || ''} disabled style={styles.input} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input value={user?.email || ''} disabled style={styles.input} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={styles.input}
              maxLength={64}
            />
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!displayName.trim() || saving}
            style={styles.saveBtn}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
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
    width: 440,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '1.1rem',
    cursor: 'pointer',
  },
  body: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    overflowY: 'auto',
  },
  avatarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  uploadBtn: {
    background: 'var(--bg-tertiary)',
    border: 'none',
    color: 'var(--text-primary)',
    padding: '8px 16px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  },
  input: {
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '16px 20px',
    borderTop: '1px solid var(--border)',
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '8px 16px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  saveBtn: {
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    padding: '8px 20px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  statusRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    color: 'var(--text-primary)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
};
