import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useFollowsStore } from '../../stores/follows.js';
import { useAuthStore } from '../../stores/auth.js';
import { Avatar } from './Avatar.js';

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}

export function FollowingTagPicker({ selectedIds, onChange, onClose }: Props) {
  const { following, fetchFollowing } = useFollowsStore();
  const userId = useAuthStore((s) => s.user?.id);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (following.length === 0 && userId) fetchFollowing(userId);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const filtered = following.filter((f) => {
    const q = search.toLowerCase();
    return f.username.toLowerCase().includes(q) || f.displayName.toLowerCase().includes(q);
  });

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div ref={ref} style={styles.container}>
      <div style={styles.header}>
        <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Tag People</span>
        <button onClick={onClose} style={styles.closeBtn}><X size={14} /></button>
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search following..."
        style={styles.search}
        autoFocus
      />
      <div style={styles.list}>
        {filtered.length === 0 && (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {following.length === 0 ? 'Not following anyone yet' : 'No matches'}
          </div>
        )}
        {filtered.map((f) => (
          <button
            key={f.id}
            onClick={() => toggle(f.id)}
            style={{
              ...styles.item,
              background: selectedIds.includes(f.id) ? 'rgba(88, 101, 242, 0.15)' : 'transparent',
            }}
          >
            <Avatar src={f.avatarUrl} name={f.displayName} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{f.displayName}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{f.username}</div>
            </div>
            {selectedIds.includes(f.id) && (
              <div style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>✓</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: 4,
    width: 280,
    maxHeight: 320,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
  },
  search: {
    margin: '6px 8px',
    padding: '0.4rem 0.6rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.82rem',
    outline: 'none',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 10px',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'var(--text-primary)',
  },
};
