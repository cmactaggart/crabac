import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useChannelsStore } from '../../stores/channels.js';
import { useSpacesStore } from '../../stores/spaces.js';
import { Permissions } from '@crabac/shared';
import type { Channel, Role, ChannelType } from '@crabac/shared';
import { Avatar } from '../common/Avatar.js';

interface ChannelMember {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Props {
  spaceId: string;
  channel: Channel;
  onClose: () => void;
}

export function ChannelSettingsPanel({ spaceId, channel, onClose }: Props) {
  const updateChannel = useChannelsStore((s) => s.updateChannel);
  const fetchChannels = useChannelsStore((s) => s.fetchChannels);
  const members = useSpacesStore((s) => s.members);

  const [name, setName] = useState(channel.name);
  const [displayName, setDisplayName] = useState(channel.displayName || '');
  const [topic, setTopic] = useState(channel.topic || '');
  const [type, setType] = useState<ChannelType>(channel.type as ChannelType);
  const [isPrivate, setIsPrivate] = useState(channel.isPrivate);
  const [saving, setSaving] = useState(false);

  // Roles
  const [roles, setRoles] = useState<Role[]>([]);
  const [overrides, setOverrides] = useState<{ roleId: string; allow: string; deny: string }[]>([]);

  // Channel members
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    api<Role[]>(`/spaces/${spaceId}/roles`).then(setRoles).catch(() => {});
    api<{ roleId: string; allow: string; deny: string }[]>(
      `/spaces/${spaceId}/channels/${channel.id}/overrides`,
    ).then(setOverrides).catch(() => {});
    api<ChannelMember[]>(
      `/spaces/${spaceId}/channels/${channel.id}/members`,
    ).then(setChannelMembers).catch(() => {});
  }, [spaceId, channel.id]);

  const DEFAULT_ALLOW = String(
    Permissions.VIEW_CHANNELS | Permissions.SEND_MESSAGES | Permissions.ATTACH_FILES | Permissions.ADD_REACTIONS,
  );

  const roleHasAccess = (roleId: string) => {
    const ov = overrides.find((o) => o.roleId === roleId);
    if (!ov) return false;
    return (BigInt(ov.allow) & Permissions.VIEW_CHANNELS) !== 0n;
  };

  const toggleRoleAccess = async (roleId: string) => {
    const has = roleHasAccess(roleId);
    try {
      if (has) {
        await api(`/spaces/${spaceId}/channels/${channel.id}/overrides/${roleId}`, { method: 'DELETE' });
        setOverrides((prev) => prev.filter((o) => o.roleId !== roleId));
      } else {
        const result = await api<{ roleId: string; allow: string; deny: string }[]>(
          `/spaces/${spaceId}/channels/${channel.id}/overrides/${roleId}`,
          { method: 'PUT', body: JSON.stringify({ allow: DEFAULT_ALLOW, deny: '0' }) },
        );
        setOverrides(result);
      }
    } catch {
      // ignore
    }
  };

  const addMember = async (userId: string) => {
    try {
      await api(`/spaces/${spaceId}/channels/${channel.id}/members/${userId}`, { method: 'PUT' });
      // Refetch members
      const updated = await api<ChannelMember[]>(`/spaces/${spaceId}/channels/${channel.id}/members`);
      setChannelMembers(updated);
    } catch {
      // ignore
    }
  };

  const removeMember = async (userId: string) => {
    try {
      await api(`/spaces/${spaceId}/channels/${channel.id}/members/${userId}`, { method: 'DELETE' });
      setChannelMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch {
      // ignore
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateChannel(spaceId, channel.id, {
        name: name !== channel.name ? name : undefined,
        displayName: displayName !== (channel.displayName || '') ? (displayName || null) : undefined,
        topic: topic !== (channel.topic || '') ? topic || undefined : undefined,
        type: type !== channel.type ? type : undefined,
        isPrivate: isPrivate !== channel.isPrivate ? isPrivate : undefined,
      });
      fetchChannels(spaceId);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePrivate = async () => {
    const newValue = !isPrivate;
    setIsPrivate(newValue);
    try {
      await updateChannel(spaceId, channel.id, { isPrivate: newValue });
      fetchChannels(spaceId);
    } catch {
      setIsPrivate(isPrivate);
    }
  };

  const nonSystemRoles = roles.filter((r: any) => !r.isSystem && !r.isDefault && !r.isGuest);
  const memberIds = new Set(channelMembers.map((m) => m.id));
  const filteredSpaceMembers = members.filter((m) => {
    if (memberIds.has(m.userId)) return false;
    if (!memberSearch) return false;
    const q = memberSearch.toLowerCase();
    return m.user?.username?.toLowerCase().includes(q) || m.user?.displayName?.toLowerCase().includes(q);
  });

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Channel Settings</h3>
        <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
      </div>

      <div style={styles.content}>
        {/* General */}
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>General</h4>

          <div style={styles.field}>
            <label style={styles.label}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
              style={styles.input}
              disabled={channel.isAdmin}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={styles.input}
              placeholder="Optional — supports emoji"
            />
            <span style={styles.hint}>Shown in sidebar and header. Leave empty to use the channel name.</span>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Topic</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              style={styles.input}
              placeholder="Channel topic..."
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as ChannelType)} style={styles.input}>
              <option value="text">Text</option>
              <option value="announcement">Announcement</option>
              <option value="read_only">Read Only</option>
              <option value="forum">Forum</option>
              <option value="media_gallery">Media Gallery</option>
              <option value="route_library">Route Library</option>
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...styles.saveBtn, opacity: saving ? 0.5 : 1 }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Access */}
        {!channel.isAdmin && (
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Access</h4>

            <div style={styles.field}>
              <label style={styles.label}>Private Channel</label>
              <button
                onClick={handleTogglePrivate}
                style={{
                  ...styles.toggle,
                  background: isPrivate ? 'var(--accent)' : 'var(--bg-tertiary)',
                }}
              >
                <div style={{
                  ...styles.toggleKnob,
                  transform: isPrivate ? 'translateX(20px)' : 'translateX(0)',
                }} />
              </button>
              <span style={styles.hint}>
                {isPrivate ? 'Only selected members and roles can see this channel' : 'Visible to all members'}
              </span>
            </div>

            {isPrivate && (
              <>
                {/* Allowed Roles */}
                {nonSystemRoles.length > 0 && (
                  <div style={styles.field}>
                    <label style={styles.label}>Allowed Roles</label>
                    <div style={styles.checkboxList}>
                      {nonSystemRoles.map((role: any) => (
                        <label key={role.id} style={styles.checkboxItem}>
                          <input
                            type="checkbox"
                            checked={roleHasAccess(role.id)}
                            onChange={() => toggleRoleAccess(role.id)}
                          />
                          {role.color && (
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: role.color, flexShrink: 0 }} />
                          )}
                          <span>{role.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Individual Members */}
                <div style={styles.field}>
                  <label style={styles.label}>Individual Members</label>
                  {channelMembers.length > 0 && (
                    <div style={styles.memberList}>
                      {channelMembers.map((m) => (
                        <div key={m.id} style={styles.memberRow}>
                          <Avatar src={m.avatarUrl} name={m.displayName || m.username} size={22} />
                          <span style={{ flex: 1, fontSize: '0.85rem' }}>{m.displayName || m.username}</span>
                          <button onClick={() => removeMember(m.id)} style={styles.removeBtn} title="Remove">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={styles.searchWrapper}>
                    <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search to add members..."
                      style={styles.searchInput}
                    />
                  </div>
                  {filteredSpaceMembers.length > 0 && (
                    <div style={styles.memberList}>
                      {filteredSpaceMembers.slice(0, 20).map((m) => (
                        <button
                          key={m.userId}
                          onClick={() => addMember(m.userId)}
                          style={styles.addMemberBtn}
                        >
                          <Avatar src={m.user?.avatarUrl || null} name={m.user?.displayName || m.user?.username || '?'} size={22} />
                          <span>{m.user?.displayName || m.user?.username}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>@{m.user?.username}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 380,
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
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 'var(--radius)',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  },
  input: {
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    padding: 2,
    transition: 'background 0.2s',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'white',
    transition: 'transform 0.2s',
  },
  saveBtn: {
    padding: '8px 16px',
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    alignSelf: 'flex-start',
  },
  checkboxList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxHeight: 200,
    overflowY: 'auto',
  },
  checkboxItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
  },
  memberList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxHeight: 200,
    overflowY: 'auto',
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    borderRadius: 'var(--radius)',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 'var(--radius)',
    display: 'flex',
  },
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  },
  searchInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  addMemberBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    width: '100%',
    textAlign: 'left',
  },
};
