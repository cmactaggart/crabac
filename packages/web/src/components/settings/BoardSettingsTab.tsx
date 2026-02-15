import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useSpacesStore } from '../../stores/spaces.js';
import type { SpaceAdminSettings } from '@crabac/shared';

interface Props {
  spaceId: string;
}

export function BoardSettingsTab({ spaceId }: Props) {
  const [settings, setSettings] = useState<SpaceAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings`)
      .then((s) => { setSettings(s); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [spaceId]);

  const handleToggle = async (key: 'allowPublicBoards' | 'allowPublicGalleries' | 'allowPublicCalendar' | 'allowAnonymousBrowsing') => {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings`, {
        method: 'PUT',
        body: JSON.stringify({ [key]: !settings[key] }),
      });
      setSettings(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const space = useSpacesStore((s) => s.spaces.find((sp) => sp.id === spaceId));

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading...</div>;

  const boardUrl = `${window.location.origin}/boards/${space?.slug || spaceId}`;
  const galleryUrl = `${window.location.origin}/gallery/${space?.slug || spaceId}`;
  const calendarUrl = `${window.location.origin}/calendar/${space?.slug || spaceId}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Enable Public Boards</span>
          <span style={styles.settingDesc}>
            Allow forum channels to be marked as public and accessible without a space membership.
          </span>
        </div>
        <button
          onClick={() => handleToggle('allowPublicBoards')}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.allowPublicBoards ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.allowPublicBoards ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Enable Public Galleries</span>
          <span style={styles.settingDesc}>
            Allow media gallery channels to be marked as public and viewable without a space membership.
          </span>
        </div>
        <button
          onClick={() => handleToggle('allowPublicGalleries')}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.allowPublicGalleries ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.allowPublicGalleries ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Enable Public Calendar</span>
          <span style={styles.settingDesc}>
            Allow the community calendar to be viewed publicly via a dedicated web page.
          </span>
        </div>
        <button
          onClick={() => handleToggle('allowPublicCalendar')}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.allowPublicCalendar ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.allowPublicCalendar ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Allow Anonymous Browsing</span>
          <span style={styles.settingDesc}>
            Let visitors browse public boards, galleries, and calendar without logging in. Posting still requires authentication.
          </span>
        </div>
        <button
          onClick={() => handleToggle('allowAnonymousBrowsing')}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.allowAnonymousBrowsing ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.allowAnonymousBrowsing ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      {settings?.allowPublicBoards && (
        <div style={styles.urlBox}>
          <span style={styles.settingLabel}>Public Board URL</span>
          <a
            href={boardUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.urlLink}
          >
            <code style={styles.urlCode}>{boardUrl}</code>
            <ExternalLink size={14} style={{ flexShrink: 0 }} />
          </a>
          <span style={styles.settingDesc}>
            Mark individual forum channels as public in the Channels tab.
          </span>
        </div>
      )}

      {settings?.allowPublicGalleries && (
        <div style={styles.urlBox}>
          <span style={styles.settingLabel}>Public Gallery URL</span>
          <a
            href={galleryUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.urlLink}
          >
            <code style={styles.urlCode}>{galleryUrl}</code>
            <ExternalLink size={14} style={{ flexShrink: 0 }} />
          </a>
          <span style={styles.settingDesc}>
            Mark individual media gallery channels as public in the Channels tab.
          </span>
        </div>
      )}

      {settings?.allowPublicCalendar && (
        <div style={styles.urlBox}>
          <span style={styles.settingLabel}>Public Calendar URL</span>
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.urlLink}
          >
            <code style={styles.urlCode}>{calendarUrl}</code>
            <ExternalLink size={14} style={{ flexShrink: 0 }} />
          </a>
          <span style={styles.settingDesc}>
            Mark individual events as public when creating or editing them.
          </span>
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
  urlBox: {
    padding: '12px 16px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  urlLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--accent)',
    textDecoration: 'none',
  },
  urlCode: {
    padding: '6px 10px',
    background: 'var(--bg-input)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    color: 'var(--accent)',
    fontFamily: 'monospace',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
};
