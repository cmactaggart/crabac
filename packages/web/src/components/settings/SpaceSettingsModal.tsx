import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Permissions, hasPermission, combinePermissions } from '@gud/shared';
import type { Role } from '@gud/shared';
import { api } from '../../lib/api.js';
import { useAuthStore } from '../../stores/auth.js';
import { useSpacesStore } from '../../stores/spaces.js';
import { useChannelsStore } from '../../stores/channels.js';
import { OverviewTab } from './OverviewTab.js';
import { ChannelsTab } from './ChannelsTab.js';
import { RolesTab } from './RolesTab.js';
import { MembersTab } from './MembersTab.js';
import { InvitesTab } from './InvitesTab.js';

interface Props {
  spaceId: string;
  onClose: () => void;
}

interface TabDef {
  key: string;
  label: string;
  permission: bigint;
}

const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview', permission: Permissions.MANAGE_SPACE },
  { key: 'channels', label: 'Channels', permission: Permissions.MANAGE_CHANNELS },
  { key: 'roles', label: 'Roles', permission: Permissions.MANAGE_ROLES },
  { key: 'members', label: 'Members', permission: Permissions.MANAGE_MEMBERS },
  { key: 'invites', label: 'Invites', permission: Permissions.MANAGE_INVITES },
];

export function SpaceSettingsModal({ spaceId, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const spaces = useSpacesStore((s) => s.spaces);
  const members = useSpacesStore((s) => s.members);
  const channels = useChannelsStore((s) => s.channels);
  const categories = useChannelsStore((s) => s.categories);
  const space = spaces.find((s) => s.id === spaceId);

  const [roles, setRoles] = useState<Role[]>([]);
  const [activeTab, setActiveTab] = useState('');

  useEffect(() => {
    api<Role[]>(`/spaces/${spaceId}/roles`).then(setRoles).catch(() => {});
  }, [spaceId]);

  const userPerms = useMemo(() => {
    if (!user || !space) return 0n;
    if (space.ownerId === user.id) return combinePermissions(...Object.values(Permissions));
    const member = members.find((m) => m.userId === user.id);
    if (!member?.roles?.length) {
      const defaultRole = roles.find((r) => r.isDefault);
      return defaultRole ? BigInt(defaultRole.permissions) : 0n;
    }
    const memberRolePerms = member.roles
      .map((r) => {
        const full = roles.find((fr) => fr.id === r.id);
        return full ? BigInt(full.permissions) : 0n;
      });
    return combinePermissions(...memberRolePerms);
  }, [user, space, members, roles]);

  const visibleTabs = useMemo(
    () => TABS.filter((t) => hasPermission(userPerms, t.permission)),
    [userPerms],
  );

  // Set initial tab once permissions are computed
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [visibleTabs, activeTab]);

  if (!space) return null;

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab space={space} onClose={onClose} />;
      case 'channels':
        return <ChannelsTab spaceId={spaceId} channels={channels} categories={categories} />;
      case 'roles':
        return <RolesTab spaceId={spaceId} />;
      case 'members':
        return <MembersTab spaceId={spaceId} members={members} />;
      case 'invites':
        return <InvitesTab spaceId={spaceId} />;
      default:
        return null;
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Left sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>{space.name}</div>
          <nav style={styles.nav}>
            {visibleTabs.map((tab) => (
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
              {visibleTabs.find((t) => t.key === activeTab)?.label}
            </h2>
            <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
          </div>
          <div style={styles.contentBody}>
            {renderTab()}
          </div>
        </div>
      </div>
    </div>
  );
}

// Shared hook: compute combined permissions for current user in a space
function useSpacePermissions(spaceId: string): bigint {
  const user = useAuthStore((s) => s.user);
  const spaces = useSpacesStore((s) => s.spaces);
  const members = useSpacesStore((s) => s.members);
  const [roles, setRoles] = useState<Role[]>([]);

  const space = spaces.find((s) => s.id === spaceId);

  useEffect(() => {
    if (spaceId) api<Role[]>(`/spaces/${spaceId}/roles`).then(setRoles).catch(() => {});
  }, [spaceId]);

  return useMemo(() => {
    if (!user || !space) return 0n;
    if (space.ownerId === user.id) return combinePermissions(...Object.values(Permissions));
    const member = members.find((m) => m.userId === user.id);
    if (!member?.roles?.length) {
      const defaultRole = roles.find((r) => r.isDefault);
      return defaultRole ? BigInt(defaultRole.permissions) : 0n;
    }
    return combinePermissions(
      ...member.roles.map((r) => {
        const full = roles.find((fr) => fr.id === r.id);
        return full ? BigInt(full.permissions) : 0n;
      }),
    );
  }, [user, space, members, roles]);
}

// Check if user should see the gear icon (has any management permission)
export function useCanManageSpace(spaceId: string): boolean {
  const perms = useSpacePermissions(spaceId);
  return useMemo(() => TABS.some((t) => hasPermission(perms, t.permission)), [perms]);
}

// Check if user has a specific permission in a space
export function useHasSpacePermission(spaceId: string, permission: bigint): boolean {
  const perms = useSpacePermissions(spaceId);
  return hasPermission(perms, permission);
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
