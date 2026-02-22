import { useState } from 'react';
import { Shield } from 'lucide-react';
import { api } from '../../lib/api.js';
import type { PersonalVisibility } from '@crabac/shared';

interface Props {
  onComplete: () => void;
}

const PROFILE_OPTIONS: { value: PersonalVisibility; label: string; desc: string }[] = [
  { value: 'public', label: 'Public', desc: 'Anyone can see your profile and public content' },
  { value: 'spaces', label: 'Spaces', desc: 'People in your spaces and friends can see your profile' },
  { value: 'friends', label: 'Friends', desc: 'Only your friends can see your profile' },
  { value: 'private', label: 'Private', desc: 'Nobody can see your profile — it\'s completely hidden' },
];

const CONTENT_OPTIONS: { value: PersonalVisibility; label: string; desc: string }[] = [
  { value: 'public', label: 'Public', desc: 'New posts, photos, routes, and events visible to everyone' },
  { value: 'spaces', label: 'Spaces', desc: 'Visible to people in your spaces and friends' },
  { value: 'friends', label: 'Friends', desc: 'Visible only to your friends' },
  { value: 'private', label: 'Private', desc: 'Only you can see new content' },
];

export function OnboardingModal({ onComplete }: Props) {
  const [profileVisibility, setProfileVisibility] = useState<PersonalVisibility>('spaces');
  const [defaultVisibility, setDefaultVisibility] = useState<PersonalVisibility>('private');
  const [saving, setSaving] = useState(false);

  const handleDone = async () => {
    setSaving(true);
    try {
      await api('/users/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          profileVisibility,
          defaultVisibility,
          onboardingCompleted: true,
        }),
      });
      onComplete();
    } catch {
      // Still close on error to avoid blocking the user
      onComplete();
    }
    setSaving(false);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <Shield size={24} style={{ color: 'var(--accent)' }} />
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Welcome to crab.ac!</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Let's set up your privacy preferences.
          </p>
        </div>

        {/* Profile Visibility */}
        <div style={styles.section}>
          <label style={styles.label}>Who can see your profile?</label>
          <div style={styles.optionGrid}>
            {PROFILE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setProfileVisibility(opt.value)}
                style={{
                  ...styles.optionBtn,
                  borderColor: profileVisibility === opt.value ? 'var(--accent)' : 'var(--border)',
                  background: profileVisibility === opt.value ? 'rgba(88, 101, 242, 0.1)' : 'var(--bg-input)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: profileVisibility === opt.value ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Default Content Visibility */}
        <div style={styles.section}>
          <label style={styles.label}>Default content visibility</label>
          <div style={styles.optionGrid}>
            {CONTENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDefaultVisibility(opt.value)}
                style={{
                  ...styles.optionBtn,
                  borderColor: defaultVisibility === opt.value ? 'var(--accent)' : 'var(--border)',
                  background: defaultVisibility === opt.value ? 'rgba(88, 101, 242, 0.1)' : 'var(--bg-input)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: defaultVisibility === opt.value ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleDone} disabled={saving} style={styles.doneBtn}>
          {saving ? 'Saving...' : 'Done'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '24px',
    width: '100%',
    maxWidth: 460,
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    marginBottom: 8,
  },
  optionGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  optionBtn: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--radius)',
    border: '2px solid var(--border)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  doneBtn: {
    width: '100%',
    padding: '10px',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
};
