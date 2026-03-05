import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { useSpacesStore } from '../../stores/spaces.js';
import type { SpaceAdminSettings } from '@crabac/shared';

interface Props {
  spaceId: string;
}

export function SocialSettingsTab({ spaceId }: Props) {
  const [settings, setSettings] = useState<SpaceAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fetchSpaces = useSpacesStore((s) => s.fetchSpaces);
  const space = useSpacesStore((s) => s.spaces.find((sp) => sp.id === spaceId));

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
        body: JSON.stringify({ socialEnabled: !settings.socialEnabled }),
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
          <span style={styles.settingLabel}>Enable Social Profile</span>
          <span style={styles.settingDesc}>
            Allow this space to have a public social profile and post to the feed. Members with the Manage Social permission can post on behalf of the space.
          </span>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.socialEnabled ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.socialEnabled ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      {settings?.socialEnabled && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <p style={{ margin: '0 0 8px' }}>
            The space's social profile is live at <strong>/p/{space?.slug || 'your-slug'}</strong>.
          </p>
          <p style={{ margin: 0 }}>
            Space posts will appear in the feed of all space members. To let specific roles post as the space, grant them the <strong>Manage Social</strong> permission in the Roles tab.
          </p>
        </div>
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
