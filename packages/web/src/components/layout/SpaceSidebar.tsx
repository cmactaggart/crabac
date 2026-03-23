import { useRef, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, User, Bell, BellOff, Newspaper, CheckCheck, LogOut, ExternalLink } from 'lucide-react';
import { useDMStore } from '../../stores/dm.js';
import { useNotificationsStore } from '../../stores/notifications.js';
import { useChannelsStore } from '../../stores/channels.js';
import { useAuthStore } from '../../stores/auth.js';
import { useSpacesStore } from '../../stores/spaces.js';
import { CrabIcon } from '../icons/CrabIcon.js';
import { getContrastColor } from '../spaces/SpaceBrandedCard.js';
import { LetterIcon } from '../icons/LetterIcon.js';
import { ContextMenu, type ContextMenuItem } from '../common/ContextMenu.js';
import { api } from '../../lib/api.js';
import type { Space } from '@crabac/shared';

interface Props {
  spaces: Space[];
  activeSpaceId: string | null;
  hideNavIcons?: boolean;
}

export function SpaceSidebar({ spaces, activeSpaceId, hideNavIcons }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const dmUnreads = useDMStore((s) => s.dmUnreads);
  const totalDMUnreads = Object.values(dmUnreads).reduce((sum, n) => sum + n, 0);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; space: Space } | null>(null);

  const handleSpaceMouseEnter = useCallback((spaceId: string) => {
    if (spaceId === activeSpaceId) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      useChannelsStore.getState().prefetchSpace(spaceId);
    }, 150);
  }, [activeSpaceId]);

  const handleSpaceMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, space: Space) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, space });
  }, []);

  const handleMarkAllRead = useCallback((space: Space) => {
    const { unreads } = useChannelsStore.getState();
    const cleared: Record<string, { unreadCount: number; mentionCount: number }> = {};
    for (const channelId of Object.keys(unreads)) {
      cleared[channelId] = { unreadCount: 0, mentionCount: 0 };
    }
    useChannelsStore.setState((s) => ({ unreads: { ...s.unreads, ...cleared } }));
    setContextMenu(null);
  }, []);

  const handleLeaveSpace = useCallback(async (space: Space) => {
    setContextMenu(null);
    if (!confirm(`Are you sure you want to leave ${space.name}?`)) return;
    try {
      await api(`/spaces/${space.id}/leave`, { method: 'POST' });
      navigate('/');
    } catch (err: any) {
      alert(err.message || 'Failed to leave space');
    }
  }, [navigate]);

  const isYouActive = location.pathname === '/you' || location.pathname.startsWith('/p/');
  const isNotificationsActive = location.pathname === '/notifications';
  const isFeedActive = location.pathname === '/feed';
  const isDMActive = location.pathname.startsWith('/dm');

  const mutedSpaces = useSpacesStore((s) => s.mutedSpaces);
  const toggleSpaceMute = useSpacesStore((s) => s.toggleSpaceMute);

  const getContextMenuItems = (space: Space): ContextMenuItem[] => {
    const isMuted = mutedSpaces.has(space.id);
    const items: ContextMenuItem[] = [
      {
        label: 'Mark All as Read',
        icon: <CheckCheck size={16} />,
        onClick: () => handleMarkAllRead(space),
      },
      {
        label: isMuted ? 'Unmute Space' : 'Mute Space',
        icon: isMuted ? <Bell size={16} /> : <BellOff size={16} />,
        onClick: () => toggleSpaceMute(space.id),
      },
    ];

    if (space.slug) {
      items.push({
        label: 'View Profile',
        icon: <ExternalLink size={16} />,
        onClick: () => {
          navigate(`/p/${space.slug}`);
          setContextMenu(null);
        },
      });
    }

    items.push(
      { label: '', icon: undefined, separator: true, onClick: () => {} },
      {
        label: 'Leave Space',
        icon: <LogOut size={16} />,
        danger: true,
        onClick: () => handleLeaveSpace(space),
      },
    );

    return items;
  };

  return (
    <div style={styles.sidebar}>
      {!hideNavIcons && (
        <>
          {/* Home button */}
          <button
            onClick={() => navigate('/')}
            style={{ ...styles.icon, background: activeSpaceId ? 'var(--bg-tertiary)' : 'var(--accent)' }}
            title="Home"
          >
            <CrabIcon size={28} />
          </button>

          {/* You button */}
          <button
            onClick={() => navigate('/you')}
            style={{
              ...styles.icon,
              background: isYouActive ? 'var(--accent)' : 'var(--bg-tertiary)',
            }}
            title="You"
          >
            <User size={20} />
          </button>

          {/* Notifications button */}
          <button
            onClick={() => navigate('/notifications')}
            style={{
              ...styles.icon,
              background: isNotificationsActive ? 'var(--accent)' : 'var(--bg-tertiary)',
              position: 'relative',
            }}
            title="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span style={styles.badge}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Feed button */}
          <button
            onClick={() => navigate('/feed')}
            style={{
              ...styles.icon,
              background: isFeedActive ? 'var(--accent)' : 'var(--bg-tertiary)',
            }}
            title="Feed"
          >
            <Newspaper size={20} />
          </button>

          {/* DM button */}
          <button
            onClick={() => navigate('/dm')}
            style={{
              ...styles.icon,
              background: isDMActive ? 'var(--accent)' : 'var(--bg-tertiary)',
              position: 'relative',
            }}
            title="Direct Messages"
          >
            <Mail size={20} />
            {totalDMUnreads > 0 && (
              <span style={styles.badge}>
                {totalDMUnreads > 99 ? '99+' : totalDMUnreads}
              </span>
            )}
          </button>
        </>
      )}

      <div style={styles.divider} />

      {spaces.map((space) => {
        const isActive = space.id === activeSpaceId;
        const hasGradient = space.baseColor && space.accentColor;
        let bg: string;
        if (space.iconUrl) {
          bg = 'transparent';
        } else if (hasGradient) {
          bg = `linear-gradient(135deg, ${space.baseColor} 30%, ${space.accentColor} 100%)`;
        } else if (isActive) {
          bg = 'var(--accent)';
        } else {
          bg = 'var(--bg-tertiary)';
        }

        const letterColor = space.textColor || (space.accentColor ? getContrastColor(space.accentColor) : '#fff');

        return (
          <button
            key={space.id}
            onClick={() => navigate(`/space/${space.id}`)}
            onContextMenu={(e) => handleContextMenu(e, space)}
            onMouseEnter={() => handleSpaceMouseEnter(space.id)}
            onMouseLeave={handleSpaceMouseLeave}
            style={{
              ...styles.icon,
              background: space.iconUrl ? 'transparent' : 'none',
              borderRadius: isActive ? '16px' : '50%',
              overflow: 'hidden',
              padding: 0,
              border: isActive && hasGradient ? `2px solid ${space.accentColor}` : 'none',
            }}
            title={space.name}
          >
            {space.iconUrl ? (
              <img src={space.iconUrl} alt={space.name} style={{ width: 48, height: 48, objectFit: 'cover' }} />
            ) : (
              <LetterIcon
                letter={space.name.charAt(0)}
                size={48}
                bg={hasGradient ? undefined : (isActive ? 'var(--accent)' : 'var(--bg-tertiary)')}
                color={letterColor}
                gradient={hasGradient ? { base: space.baseColor!, accent: space.accentColor! } : undefined}
              />
            )}
          </button>
        );
      })}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.space)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 72,
    height: '100%',
    background: 'linear-gradient(to bottom, var(--bg-primary), color-mix(in srgb, var(--bg-primary), black 18%))',
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
