import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import type { SpaceAdminSettings } from '@crabac/shared';

interface Props {
  spaceId: string;
}

export function NewsletterSettingsTab({ spaceId }: Props) {
  const [settings, setSettings] = useState<SpaceAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings`)
      .then((s) => { setSettings(s); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [spaceId]);

  const handleToggle = async (key: 'newsletterEnabled' | 'newsletterTrackingEnabled') => {
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
      setError(err.message || 'Failed to update');
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
          <span style={styles.settingLabel}>Enable Newsletter</span>
          <span style={styles.settingDesc}>
            Show the Newsletter channel in the sidebar and allow creating/publishing newsletters.
          </span>
        </div>
        <button
          onClick={() => handleToggle('newsletterEnabled')}
          disabled={saving}
          style={{ ...styles.toggle, background: settings?.newsletterEnabled ? 'var(--accent)' : 'var(--bg-tertiary)' }}
        >
          <div style={{ ...styles.toggleKnob, transform: settings?.newsletterEnabled ? 'translateX(18px)' : 'translateX(0)' }} />
        </button>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Email Tracking</span>
          <span style={styles.settingDesc}>
            Track open and click rates for newsletter emails. Disable to respect subscriber privacy.
          </span>
        </div>
        <button
          onClick={() => handleToggle('newsletterTrackingEnabled')}
          disabled={saving}
          style={{ ...styles.toggle, background: settings?.newsletterTrackingEnabled ? 'var(--accent)' : 'var(--bg-tertiary)' }}
        >
          <div style={{ ...styles.toggleKnob, transform: settings?.newsletterTrackingEnabled ? 'translateX(18px)' : 'translateX(0)' }} />
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  settingRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' },
  settingInfo: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  settingLabel: { fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' },
  settingDesc: { fontSize: '0.8rem', color: 'var(--text-muted)' },
  toggle: { width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative', padding: 2, flexShrink: 0, transition: 'background 0.2s' },
  toggleKnob: { width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'transform 0.2s' },
  error: { background: 'rgba(237,66,69,0.15)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: '0.875rem' },
};
