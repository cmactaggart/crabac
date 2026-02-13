import { useNavigate } from 'react-router-dom';
import { Mail, ChevronsLeft } from 'lucide-react';
import { useLayoutStore } from '../../stores/layout.js';
import { useDMStore } from '../../stores/dm.js';
import { CrabIcon } from '../icons/CrabIcon.js';
import type { Space } from '@crabac/shared';

interface Props {
  spaces: Space[];
  activeSpaceId: string | null;
}

export function SpaceSidebar({ spaces, activeSpaceId }: Props) {
  const navigate = useNavigate();
  const toggleSpaceSidebar = useLayoutStore((s) => s.toggleSpaceSidebar);
  const dmUnreads = useDMStore((s) => s.dmUnreads);
  const totalDMUnreads = Object.values(dmUnreads).reduce((sum, n) => sum + n, 0);

  return (
    <div style={styles.sidebar}>
      {/* Home button */}
      <button
        onClick={() => navigate('/')}
        style={{ ...styles.icon, background: activeSpaceId ? 'var(--bg-tertiary)' : 'var(--accent)' }}
        title="Home"
      >
        <CrabIcon size={28} />
      </button>

      {/* DM button */}
      <button
        onClick={() => navigate('/dm')}
        style={{ ...styles.icon, background: 'var(--bg-tertiary)', position: 'relative' }}
        title="Direct Messages"
      >
        <Mail size={20} />
        {totalDMUnreads > 0 && (
          <span style={styles.badge}>
            {totalDMUnreads > 99 ? '99+' : totalDMUnreads}
          </span>
        )}
      </button>

      <div style={styles.divider} />

      {spaces.map((space) => (
        <button
          key={space.id}
          onClick={() => navigate(`/space/${space.id}`)}
          style={{
            ...styles.icon,
            background: space.iconUrl ? 'transparent' : (space.id === activeSpaceId ? 'var(--accent)' : 'var(--bg-tertiary)'),
            borderRadius: space.id === activeSpaceId ? '16px' : '50%',
            overflow: 'hidden',
            padding: 0,
          }}
          title={space.name}
        >
          {space.iconUrl ? (
            <img src={space.iconUrl} alt={space.name} style={{ width: 48, height: 48, objectFit: 'cover' }} />
          ) : (
            space.name.charAt(0).toUpperCase()
          )}
        </button>
      ))}

      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
        <button onClick={toggleSpaceSidebar} style={styles.collapseBtn} title="Collapse sidebar">
          <ChevronsLeft size={18} />
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 72,
    height: '100%',
    background: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 0',
    gap: 8,
    overflowY: 'auto',
    flexShrink: 0,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '1.2rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-radius 0.15s',
    cursor: 'pointer',
  },
  divider: {
    width: 32,
    height: 2,
    background: 'var(--border)',
    borderRadius: 1,
  },
  collapseBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: 'none',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    background: 'var(--danger)',
    color: 'white',
    fontSize: '0.6rem',
    fontWeight: 700,
    padding: '1px 4px',
    borderRadius: 8,
    minWidth: 16,
    textAlign: 'center',
    lineHeight: '14px',
    border: '2px solid var(--bg-primary)',
  },
};
