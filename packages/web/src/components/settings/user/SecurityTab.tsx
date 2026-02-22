import { useState, useEffect } from 'react';
import { useAuthStore } from '../../../stores/auth.js';
import { api } from '../../../lib/api.js';
import { MfaSetup, MfaDisable } from '../../../pages/MfaSetup.js';
import type { PersonalVisibility } from '@crabac/shared';

const VISIBILITY_OPTIONS: { value: PersonalVisibility; label: string; desc: string }[] = [
  { value: 'private', label: 'Private', desc: 'Only you' },
  { value: 'friends', label: 'Friends', desc: 'Your friends' },
  { value: 'spaces', label: 'Spaces', desc: 'Shared space members' },
  { value: 'public', label: 'Public', desc: 'Everyone' },
];

export function SecurityTab() {
  const user = useAuthStore((s) => s.user);
  const [showMfa, setShowMfa] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState<PersonalVisibility>('spaces');
  const [defaultVisibility, setDefaultVisibility] = useState<PersonalVisibility>('private');
  const [bulkVisibility, setBulkVisibility] = useState<PersonalVisibility>('private');
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ gallery: number; routes: number; events: number; posts: number } | null>(null);

  useEffect(() => {
    api('/users/preferences').then((prefs: any) => {
      if (prefs.defaultVisibility) {
        setDefaultVisibility(prefs.defaultVisibility);
        setBulkVisibility(prefs.defaultVisibility);
      }
      if (prefs.profileVisibility) {
        setProfileVisibility(prefs.profileVisibility);
      }
    }).catch(() => {});
  }, []);

  const handleMfaComplete = () => {
    api('/users/me').then((u) => useAuthStore.setState({ user: u }));
    setShowMfa(false);
  };

  const handleProfileVisibilityChange = async (level: PersonalVisibility) => {
    setProfileVisibility(level);
    setProfileSaving(true);
    try {
      await api('/users/preferences', { method: 'PUT', body: JSON.stringify({ profileVisibility: level }) });
    } catch {}
    setProfileSaving(false);
  };

  const handleDefaultVisibilityChange = async (level: PersonalVisibility) => {
    setDefaultVisibility(level);
    setSaving(true);
    try {
      await api('/users/preferences', { method: 'PUT', body: JSON.stringify({ defaultVisibility: level }) });
    } catch {}
    setSaving(false);
  };

  const handleBulkUpdate = async () => {
    if (!confirm(`Are you sure? This will change the visibility of ALL your existing posts, photos, routes, and events to "${bulkVisibility}".`)) return;
    setBulkUpdating(true);
    setBulkResult(null);
    try {
      const result = await api('/me/collections/bulk-visibility', {
        method: 'POST',
        body: JSON.stringify({ visibility: bulkVisibility }),
      });
      setBulkResult(result.updated);
    } catch {}
    setBulkUpdating(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Profile Visibility */}
      <div>
        <label style={styles.label}>Who Can See Your Profile</label>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4, marginBottom: 8 }}>
          Controls who can view your profile page at crab.ac/p/{user?.username}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {VISIBILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleProfileVisibilityChange(opt.value)}
              disabled={profileSaving}
              style={{
                ...styles.visBtn,
                background: profileVisibility === opt.value ? 'var(--accent)' : 'var(--bg-input)',
                color: profileVisibility === opt.value ? 'white' : 'var(--text-secondary)',
                borderColor: profileVisibility === opt.value ? 'var(--accent)' : 'var(--border)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{opt.label}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Default Privacy */}
      <div>
        <label style={styles.label}>Default Privacy Level</label>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4, marginBottom: 8 }}>
          New posts, photos, routes, and events will use this level
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {VISIBILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleDefaultVisibilityChange(opt.value)}
              disabled={saving}
              style={{
                ...styles.visBtn,
                background: defaultVisibility === opt.value ? 'var(--accent)' : 'var(--bg-input)',
                color: defaultVisibility === opt.value ? 'white' : 'var(--text-secondary)',
                borderColor: defaultVisibility === opt.value ? 'var(--accent)' : 'var(--border)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{opt.label}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Privacy Update */}
      <div>
        <label style={styles.label}>Bulk Privacy Update</label>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4, marginBottom: 8 }}>
          Change the visibility of all your existing content at once
        </div>
        <div style={styles.settingsRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Set all to:</span>
            <select
              value={bulkVisibility}
              onChange={(e) => setBulkVisibility(e.target.value as PersonalVisibility)}
              style={{ ...styles.selectInput }}
            >
              {VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button onClick={handleBulkUpdate} disabled={bulkUpdating} style={styles.smallBtn}>
            {bulkUpdating ? 'Updating...' : 'Apply to All'}
          </button>
        </div>
        {bulkResult && (
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 'var(--radius)', background: 'rgba(67, 181, 129, 0.1)', fontSize: '0.8rem', color: '#43b581' }}>
            Updated {bulkResult.posts} posts, {bulkResult.gallery} photos, {bulkResult.routes} routes, {bulkResult.events} events
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />

      {/* Email */}
      <div>
        <label style={styles.label}>Email</label>
        <div style={styles.settingsRow}>
          <div>
            <div style={{ fontWeight: 600 }}>{user?.email}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {user?.emailVerified ? 'Verified' : 'Not verified'}
            </div>
          </div>
        </div>
      </div>

      {/* 2FA */}
      <div>
        <label style={styles.label}>Two-Factor Authentication</label>
        {showMfa ? (
          <div style={{ marginTop: 8 }}>
            {user?.totpEnabled ? (
              <MfaDisable onComplete={handleMfaComplete} />
            ) : (
              <MfaSetup onComplete={handleMfaComplete} />
            )}
            <button onClick={() => setShowMfa(false)} style={{ ...styles.smallBtn, marginTop: 12 }}>
              Cancel
            </button>
          </div>
        ) : (
          <div style={styles.settingsRow}>
            <div>
              <div style={{ fontWeight: 600 }}>
                {user?.totpEnabled ? 'Enabled' : 'Not enabled'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {user?.totpEnabled
                  ? 'Your account is protected with an authenticator app.'
                  : 'Add extra security with an authenticator app.'}
              </div>
            </div>
            <button onClick={() => setShowMfa(true)} style={styles.smallBtn}>
              {user?.totpEnabled ? 'Manage' : 'Set up'}
            </button>
          </div>
        )}
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
  settingsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-input)',
    marginTop: 8,
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
  visBtn: {
    padding: '8px 14px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    textAlign: 'center' as const,
    minWidth: 80,
    flex: 1,
  },
  selectInput: {
    padding: '0.35rem 0.5rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: '0.82rem',
  },
};
