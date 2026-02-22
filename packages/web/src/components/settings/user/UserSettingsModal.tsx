import { useState } from 'react';
import { X, LogOut } from 'lucide-react';
import { useIsMobile } from '../../../hooks/useIsMobile.js';
import { useAuthStore } from '../../../stores/auth.js';
import { ProfileTab } from './ProfileTab.js';
import { SecurityTab } from './SecurityTab.js';
import { AccountTab } from './AccountTab.js';

interface Props {
  onClose: () => void;
  inline?: boolean; // true for mobile AccountPage (no overlay)
}

const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'security', label: 'Privacy & Security' },
  { key: 'account', label: 'Account' },
];

export function UserSettingsModal({ onClose, inline }: Props) {
  const [activeTab, setActiveTab] = useState('profile');
  const isMobile = useIsMobile();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const renderTabContent = (key: string) => {
    switch (key) {
      case 'profile':
        return <ProfileTab />;
      case 'security':
        return <SecurityTab />;
      case 'account':
        return <AccountTab onClose={onClose} />;
      default:
        return null;
    }
  };

  if (isMobile) {
    const mobileContent = (
      <div style={styles.mobileModal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.mobileHeader}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>User Settings</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={handleLogout} style={styles.closeBtn} title="Sign Out"><LogOut size={18} /></button>
            {!inline && (
              <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
            )}
          </div>
        </div>
        <div style={styles.mobileBody}>
          {TABS.map((tab) => (
            <section key={tab.key} style={styles.section}>
              <h3 style={styles.sectionTitle}>{tab.label}</h3>
              {renderTabContent(tab.key)}
            </section>
          ))}
        </div>
      </div>
    );

    if (inline) return mobileContent;
    return (
      <div style={styles.overlay} onClick={onClose}>
        {mobileContent}
      </div>
    );
  }

  const content = (
    <div style={inline ? styles.inlineModal : styles.modal} onClick={(e) => e.stopPropagation()}>
      {/* Left sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>User Settings</div>
        <nav style={styles.nav}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                ...styles.navItem,
                background: activeTab === tab.key ? 'var(--hover)' : 'transparent',
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Right content */}
      <div style={styles.content}>
        <div style={styles.contentHeader}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
            {TABS.find((t) => t.key === activeTab)?.label}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={handleLogout} style={styles.closeBtn} title="Sign Out"><LogOut size={18} /></button>
            {!inline && (
              <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
            )}
          </div>
        </div>
        <div style={styles.contentBody}>
          {renderTabContent(activeTab)}
        </div>
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      {content}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    width: 700,
    maxWidth: '90vw',
    height: '70vh',
    maxHeight: 600,
    display: 'flex',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  inlineModal: {
    background: 'var(--bg-primary)',
    display: 'flex',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  mobileModal: {
    background: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
  },
  mobileHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  mobileBody: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '0 16px 80px',
  },
  section: {
    padding: '16px 0',
    borderBottom: '1px solid var(--border)',
  },
  sectionTitle: {
    margin: '0 0 12px',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  },
  sidebar: {
    width: 180,
    background: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  sidebarHeader: {
    padding: '16px',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)',
  },
  nav: {
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  navItem: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  contentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  contentBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 'var(--radius)',
  },
};
