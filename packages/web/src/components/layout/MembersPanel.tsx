import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useLayoutStore } from '../../stores/layout.js';
import { useAuthStore } from '../../stores/auth.js';
import { useDMStore } from '../../stores/dm.js';
import { Avatar } from '../common/Avatar.js';
import { UserProfilePopover } from '../common/UserProfilePopover.js';
import type { SpaceMember } from '@crabac/shared';

interface Props {
  members: SpaceMember[];
  spaceId?: string;
  asOverlay?: boolean;
}

const STATUS_DOT_COLORS: Record<string, string> = {
  online: 'var(--success)',
  idle: '#faa61a',
  dnd: 'var(--danger)',
  offline: 'var(--text-muted)',
};

export function MembersPanel({ members, spaceId, asOverlay }: Props) {
  const toggleMembersSidebar = useLayoutStore((s) => s.toggleMembersSidebar);
  const user = useAuthStore((s) => s.user);
  const createConversation = useDMStore((s) => s.createConversation);
  const navigate = useNavigate();

  const [popover, setPopover] = useState<{ userId: string; rect: DOMRect } | null>(null);

  const handleMemberClick = useCallback((userId: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ userId, rect });
  }, []);

  const handleMessage = useCallback(async (userId: string) => {
    try {
      const conv = await createConversation(userId);
      navigate(`/dm/${conv.id}`);
    } catch {
      // ignore
    }
  }, [createConversation, navigate]);

  const online = members.filter((m) => m.user?.status && m.user.status !== 'offline');
  const offline = members.filter((m) => !m.user?.status || m.user.status === 'offline');

  const renderMember = (m: SpaceMember) => {
    const status = m.user?.status || 'offline';
    const isOffline = status === 'offline';

    return (
      <button
        key={m.userId}
        onClick={(e) => handleMemberClick(m.userId, e)}
        style={styles.memberRow}
      >
        <div style={styles.avatarWrap}>
          <Avatar
            src={m.user?.avatarUrl || null}
            name={m.user?.displayName || '?'}
            size={28}
            dimmed={isOffline}
          />
          <span
            style={{
              ...styles.statusDot,
              background: STATUS_DOT_COLORS[status] || STATUS_DOT_COLORS.offline,
            }}
          />
        </div>
        <span
          style={{
            color: isOffline ? 'var(--text-muted)' : 'var(--text-primary)',
            fontSize: '0.875rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {m.user?.displayName}
        </span>
      </button>
    );
  };

  const panelContent = (
    <div style={asOverlay ? { ...styles.panel, width: '100%', maxWidth: 360, height: '80vh', borderRadius: 'var(--radius)' } : styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>Members — {members.length}</span>
        <button onClick={toggleMembersSidebar} style={styles.closeBtn} title="Close members">
          <X size={16} />
        </button>
      </div>
      <div style={styles.list}>
        {online.length > 0 && (
          <>
            <div style={styles.sectionLabel}>Online — {online.length}</div>
            {online.map(renderMember)}
          </>
        )}
        {offline.length > 0 && (
          <>
            <div style={styles.sectionLabel}>Offline — {offline.length}</div>
            {offline.map(renderMember)}
          </>
        )}
      </div>

      {popover && user && (
        <UserProfilePopover
          userId={popover.userId}
          anchorRect={popover.rect}
          onClose={() => setPopover(null)}
          onMessage={handleMessage}
          currentUserId={user.id}
          spaceId={spaceId}
        />
      )}
    </div>
  );

  if (asOverlay) {
    return (
      <div
        style={styles.overlay}
        onClick={toggleMembersSidebar}
      >
        <div onClick={(e) => e.stopPropagation()}>
          {panelContent}
        </div>
      </div>
    );
  }

  return panelContent;
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 240,
    height: '100%',
    background: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: 48,
    borderBottom: '1px solid var(--border)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    flexShrink: 0,
  },
  title: {
    fontWeight: 700,
    fontSize: '0.9rem',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: 'var(--radius)',
    display: 'flex',
    alignItems: 'center',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
  },
  sectionLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '8px 8px 4px',
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    borderRadius: 'var(--radius)',
    width: '100%',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
    width: 28,
    height: 28,
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: '50%',
    border: '2px solid var(--bg-secondary)',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 90,
  },
};
