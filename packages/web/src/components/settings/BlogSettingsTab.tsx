import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { useSpacesStore } from '../../stores/spaces.js';
import type { SpaceAdminSettings } from '@crabac/shared';

interface Props {
  spaceId: string;
}

export function BlogSettingsTab({ spaceId }: Props) {
  const [settings, setSettings] = useState<SpaceAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fetchSpaces = useSpacesStore((s) => s.fetchSpaces);

  useEffect(() => {
    api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings`)
      .then((s) => { setSettings(s); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [spaceId]);

  const handleToggle = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings`, {
        method: 'PUT',
        body: JSON.stringify({ blogEnabled: !settings.blogEnabled }),
      });
      setSettings(updated);
      fetchSpaces();
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Enable Community Blog</span>
          <span style={styles.settingDesc}>
            Show a blog in the channel sidebar. Members with the Manage Blog permission can create and publish posts.
          </span>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.blogEnabled ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.blogEnabled ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      {settings?.blogEnabled && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
          Blog is enabled. To make posts visible on the public web page, enable "Enable Public Blog" in the Public Web tab and mark individual posts as public.
        </p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '12px 0',
    borderBottom: '1px solid var(--border)',
  },
  settingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
  },
  settingLabel: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  settingDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    padding: 2,
    flexShrink: 0,
    transition: 'background 0.2s',
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: '#fff',
    transition: 'transform 0.2s',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
};
