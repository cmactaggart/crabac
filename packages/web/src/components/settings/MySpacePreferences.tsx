import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../lib/api.js';

interface Props {
  spaceId: string;
  onClose: () => void;
}

interface SpaceSettings {
  suppressMentions: boolean;
  suppressEveryone: boolean;
  muteAll: boolean;
}

export function MySpacePreferences({ spaceId, onClose }: Props) {
  const [settings, setSettings] = useState<SpaceSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<SpaceSettings>(`/spaces/${spaceId}/settings/me`)
      .then(setSettings)
      .catch(() => setSettings({ suppressMentions: false, suppressEveryone: false, muteAll: false }));
  }, [spaceId]);

  const toggle = async (key: keyof SpaceSettings) => {
    if (!settings) return;
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    setSaving(true);
    try {
      const result = await api<SpaceSettings>(`/spaces/${spaceId}/settings/me`, {
        method: 'PUT',
        body: JSON.stringify({ [key]: updated[key] }),
      });
      setSettings(result);
    } catch {
      // Revert on error
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={styles.modal}>
        <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Notification Preferences</h2>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Control which notifications you receive from this space.
        </p>

        {!settings ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <ToggleRow
              label="Suppress @mentions"
              description="Don't notify me when I'm directly @mentioned"
              checked={settings.suppressMentions}
              onChange={() => toggle('suppressMentions')}
              disabled={saving}
            />
            <ToggleRow
              label="Suppress @everyone / @here"
              description="Don't notify me for group mentions"
              checked={settings.suppressEveryone}
              onChange={() => toggle('suppressEveryone')}
              disabled={saving}
            />
            <ToggleRow
              label="Mute all notifications"
              description="Mute everything from this space"
              checked={settings.muteAll}
              onChange={() => toggle('muteAll')}
              disabled={saving}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange, disabled }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <div style={styles.row}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{description}</div>
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        style={{
          ...styles.toggle,
          background: checked ? 'var(--accent)' : 'var(--bg-input)',
          justifyContent: checked ? 'flex-end' : 'flex-start',
        }}
      >
        <span style={styles.toggleKnob} />
      </button>
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
    background: 'var(--bg-secondary)',
    padding: '1.5rem',
    borderRadius: 'var(--radius)',
    width: '100%',
    maxWidth: '380px',
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
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-input)',
  },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    border: '2px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: 2,
    cursor: 'pointer',
    transition: 'background 0.15s, justify-content 0.15s',
    flexShrink: 0,
  },
  toggleKnob: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: 'white',
  },
};
