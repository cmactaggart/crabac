import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Mail, User, Newspaper } from 'lucide-react';
import { CrabIcon } from '../icons/CrabIcon.js';
import { useNotificationsStore } from '../../stores/notifications.js';
import { useDMStore } from '../../stores/dm.js';

export function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const dmUnreads = useDMStore((s) => s.dmUnreads);
  const totalDMUnreads = Object.values(dmUnreads).reduce((sum, n) => sum + n, 0);

  const tabs: { icon: typeof Bell | null; label: string; path: string; badgeKey?: 'notifications' | 'messages' }[] = [
    { icon: null, label: 'Spaces', path: '/' },
    { icon: Newspaper, label: 'Feed', path: '/feed' },
    { icon: Mail, label: 'Messages', path: '/dm', badgeKey: 'messages' },
    { icon: Bell, label: 'Notifications', path: '/notifications', badgeKey: 'notifications' },
    { icon: User, label: 'You', path: '/you' },
  ];

  const activeTab = tabs.find((t) => location.pathname === t.path || (t.path === '/dm' && location.pathname.startsWith('/dm')))?.path
    || (location.pathname.startsWith('/space') || location.pathname.startsWith('/p/') ? null : '/');

  return (
    <div style={styles.bar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.path;
        const color = isActive ? 'var(--accent)' : 'var(--text-muted)';
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{ ...styles.tab, color }}
          >
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              {tab.icon ? (() => { const Icon = tab.icon; return <Icon size={22} />; })() : (
                <CrabIcon size={22} color={color} />
              )}
              {tab.badgeKey === 'notifications' && unreadCount > 0 && (
                <span style={styles.badge}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {tab.badgeKey === 'messages' && totalDMUnreads > 0 && (
                <span style={styles.badge}>
                  {totalDMUnreads > 99 ? '99+' : totalDMUnreads}
                </span>
              )}
            </div>
            <span style={styles.label}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 50,
  },
  tab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px 16px',
  },
  label: {
    fontSize: '0.65rem',
    fontWeight: 600,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    background: 'var(--danger)',
    color: 'white',
    fontSize: '0.55rem',
    fontWeight: 700,
    padding: '1px 4px',
    borderRadius: 8,
    minWidth: 14,
    textAlign: 'center',
    lineHeight: '12px',
  },
};
