import { useAuthStore } from '../../../stores/auth.js';

interface Props {
  onClose: () => void;
}

export function AccountTab({ onClose }: Props) {
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Sign Out */}
      <div>
        <label style={styles.label}>Session</label>
        <div style={{ marginTop: 8 }}>
          <button onClick={handleLogout} style={styles.dangerBtn}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div>
        <label style={styles.label}>Danger Zone</label>
        <div style={styles.dangerZone}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Account deletion is not yet available. Contact support if needed.
          </div>
        </div>
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
  dangerBtn: {
    padding: '0.55rem 1.25rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--danger)',
    background: 'transparent',
    color: 'var(--danger)',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  dangerZone: {
    marginTop: 8,
    padding: '0.75rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--danger)',
    background: 'rgba(237, 66, 69, 0.05)',
  },
};
