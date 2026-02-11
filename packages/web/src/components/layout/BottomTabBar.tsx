import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Bell, User } from 'lucide-react';
import { useNotificationsStore } from '../../stores/notifications.js';

export function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useNotificationsStore((s) => s.unreadCount);

  const tabs = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Bell, label: 'Notifications', path: '/notifications' },
    { icon: User, label: 'Account', path: '/account' },
  ];

  const activeTab = tabs.find((t) => location.pathname === t.path)?.path
    || (location.pathname.startsWith('/space') || location.pathname.startsWith('/dm') ? null : '/');

  return (
    <div style={styles.bar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.path;
        const Icon = tab.icon;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              ...styles.tab,
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon size={22} />
              {tab.path === '/notifications' && unreadCount > 0 && (
                <span style={styles.badge}>
                  {unreadCount > 99 ? '99+' : unreadCount}
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
