import { useState, useRef } from 'react';
import { Camera } from 'lucide-react';
import { useAuthStore } from '../../../stores/auth.js';
import { Avatar } from '../../common/Avatar.js';

export function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [baseColor, setBaseColor] = useState(user?.baseColor || '');
  const [accentColor, setAccentColor] = useState(user?.accentColor || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const hasNameChange = displayName !== (user?.displayName || '');
  const hasColorChange =
    baseColor !== (user?.baseColor || '') ||
    accentColor !== (user?.accentColor || '');

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await uploadAvatar(file);
    } catch (err: any) {
      setError(err.message || 'Failed to upload avatar');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    setError('');
    try {
      await updateProfile({
        displayName: displayName.trim(),
        baseColor: baseColor || null,
        accentColor: accentColor || null,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && <div style={styles.error}>{error}</div>}

      {/* Avatar */}
      <div>
        <label style={styles.label}>Avatar</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: 8 }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
            <Avatar src={user?.avatarUrl ?? null} name={user?.displayName || '?'} size={72} baseColor={user?.baseColor ?? null} accentColor={user?.accentColor ?? null} />
            <div style={styles.avatarOverlay}>
              <Camera size={18} />
            </div>
          </div>
          <div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={styles.smallBtn}>
              {uploading ? 'Uploading...' : 'Change Avatar'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
          </div>
        </div>
      </div>

      {/* Display Name */}
      <div>
        <label style={styles.label}>Display Name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={styles.input}
          maxLength={100}
        />
      </div>

      {/* User Colors */}
      <div>
        <label style={styles.label}>User Colors</label>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 8px' }}>
          Customize your avatar gradient and accent color across the platform.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 150 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Base</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={baseColor || '#5865f2'}
                onChange={(e) => setBaseColor(e.target.value)}
                style={styles.colorInput}
              />
              <input
                value={baseColor}
                onChange={(e) => setBaseColor(e.target.value)}
                placeholder="#5865f2"
                style={{ ...styles.input, width: 90, fontSize: '0.8rem' }}
              />
            </div>
          </div>
          <div style={{ minWidth: 150 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Accent</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={accentColor || '#eb459e'}
                onChange={(e) => setAccentColor(e.target.value)}
                style={styles.colorInput}
              />
              <input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#eb459e"
                style={{ ...styles.input, width: 90, fontSize: '0.8rem' }}
              />
            </div>
          </div>
        </div>
        {(baseColor || accentColor) && (
          <button
            onClick={() => { setBaseColor(''); setAccentColor(''); }}
            style={{ ...styles.smallBtn, marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}
          >
            Reset colors
          </button>
        )}
      </div>

      {/* Save */}
      {(hasNameChange || hasColorChange) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSave} disabled={saving || !displayName.trim()} style={styles.saveBtn}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
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
  input: {
    width: '100%',
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    outline: 'none',
    marginTop: 4,
  },
  colorInput: {
    width: 36,
    height: 36,
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    padding: 0,
    background: 'transparent',
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
  },
  saveBtn: {
    padding: '0.55rem 1.25rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  avatarOverlay: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    opacity: 0,
    transition: 'opacity 0.15s',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
};
