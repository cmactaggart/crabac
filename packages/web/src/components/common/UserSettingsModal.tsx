import { useState, useRef } from 'react';
import { X, Shuffle } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.js';
import { getSocket } from '../../lib/socket.js';
import { Avatar } from './Avatar.js';
import { LetterIcon } from '../icons/LetterIcon.js';

const COLOR_PALETTE = [
  { base: '#667eea', accent: '#764ba2' },
  { base: '#f093fb', accent: '#f5576c' },
  { base: '#4facfe', accent: '#00f2fe' },
  { base: '#43e97b', accent: '#38f9d7' },
  { base: '#fa709a', accent: '#fee140' },
  { base: '#a18cd1', accent: '#fbc2eb' },
  { base: '#fccb90', accent: '#d57eeb' },
  { base: '#e0c3fc', accent: '#8ec5fc' },
  { base: '#f5576c', accent: '#ff9a76' },
  { base: '#6991c7', accent: '#a3bded' },
  { base: '#13547a', accent: '#80d0c7' },
  { base: '#ff0844', accent: '#ffb199' },
  { base: '#c471f5', accent: '#fa71cd' },
  { base: '#48c6ef', accent: '#6f86d6' },
  { base: '#a1c4fd', accent: '#c2e9fb' },
  { base: '#d4fc79', accent: '#96e6a1' },
  { base: '#84fab0', accent: '#8fd3f4' },
  { base: '#f6d365', accent: '#fda085' },
  { base: '#ffecd2', accent: '#fcb69f' },
  { base: '#a6c0fe', accent: '#f68084' },
];

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a2e' : '#ffffff';
}

interface Props {
  onClose: () => void;
}

export function UserSettingsModal({ onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar);
  const setStatus = useAuthStore((s) => s.setStatus);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [baseColor, setBaseColor] = useState(user?.baseColor || '#667eea');
  const [accentColor, setAccentColor] = useState(user?.accentColor || '#764ba2');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!displayName.trim() || saving) return;
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        baseColor,
        accentColor,
      });
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

  const handleRandomize = () => {
    const combo = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    setBaseColor(combo.base);
    setAccentColor(combo.accent);
  };

  const initial = (user?.displayName || '?').charAt(0).toUpperCase();

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
            <Avatar src={user?.avatarUrl || null} name={user?.displayName || '?'} size={80} baseColor={baseColor} accentColor={accentColor} />
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

          {/* Profile Colors */}
          <div style={styles.field}>
            <label style={styles.label}>Profile Colors</label>
            <div style={styles.colorSection}>
              <div style={styles.colorPreview}>
                <LetterIcon
                  letter={initial}
                  size={64}
                  gradient={{ base: baseColor, accent: accentColor }}
                  color={getContrastColor(accentColor)}
                />
              </div>
              <div style={styles.colorControls}>
                <div style={styles.colorRow}>
                  <label style={styles.colorLabel}>Base</label>
                  <div style={styles.colorInputWrap}>
                    <input
                      type="color"
                      value={baseColor}
                      onChange={(e) => setBaseColor(e.target.value)}
                      style={styles.colorInput}
                    />
                    <span style={styles.colorHex}>{baseColor}</span>
                  </div>
                </div>
                <div style={styles.colorRow}>
                  <label style={styles.colorLabel}>Accent</label>
                  <div style={styles.colorInputWrap}>
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      style={styles.colorInput}
                    />
                    <span style={styles.colorHex}>{accentColor}</span>
                  </div>
                </div>
                <button onClick={handleRandomize} style={styles.randomizeBtn}>
                  <Shuffle size={14} /> Randomize
                </button>
              </div>
            </div>
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
  colorSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  colorPreview: {
    flexShrink: 0,
  },
  colorControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
  },
  colorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  colorLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    width: 48,
  },
  colorInputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  colorInput: {
    width: 32,
    height: 32,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    padding: 0,
    background: 'none',
  },
  colorHex: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  randomizeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '5px 12px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    width: 'fit-content',
  },
};
