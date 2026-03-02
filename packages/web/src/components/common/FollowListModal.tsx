import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Avatar } from './Avatar.js';
import type { FollowUser } from '@crabac/shared';

export function FollowListModal({ mode, users, onClose }: {
  mode: 'followers' | 'following';
  users: FollowUser[];
  onClose: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>
            {mode === 'followers' ? 'Followers' : 'Following'}
          </h3>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={18} />
          </button>
        </div>

        {users.length === 0 && (
          <div style={styles.empty}>
            No {mode} yet
          </div>
        )}

        <div style={styles.list}>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => { onClose(); navigate(`/p/${u.username}`); }}
              style={styles.userBtn}
            >
              <Avatar
                src={u.avatarUrl}
                name={u.displayName}
                size={32}
                baseColor={u.baseColor}
                accentColor={u.accentColor}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{u.displayName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{u.username}</div>
              </div>
            </button>
          ))}
        </div>
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
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    padding: '1rem',
    maxWidth: 400,
    width: '100%',
    maxHeight: '70vh',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  title: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
  },
  empty: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    padding: '2rem',
    fontSize: '0.9rem',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  userBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    width: '100%',
    textAlign: 'left',
  },
};
