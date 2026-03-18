import { useState, useEffect } from 'react';
import { X, Hash, Lock, Search } from 'lucide-react';
import { useChannelsStore } from '../../stores/channels.js';
import { useSpacesStore } from '../../stores/spaces.js';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import type { ChannelCategory, ChannelType, Role } from '@crabac/shared';
import { Avatar } from '../common/Avatar.js';

interface Props {
  spaceId: string;
  categories: ChannelCategory[];
  defaultCategoryId?: string;
  onClose: () => void;
}

export function CreateChannelModal({ spaceId, categories, defaultCategoryId, onClose }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [topic, setTopic] = useState('');
  const [channelType, setChannelType] = useState<ChannelType>('text');
  const [categoryId, setCategoryId] = useState(defaultCategoryId || '');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const createChannel = useChannelsStore((s) => s.createChannel);
  const members = useSpacesStore((s) => s.members);
  const navigate = useNavigate();

  useEffect(() => {
    api<Role[]>(`/spaces/${spaceId}/roles`).then(setRoles).catch(() => {});
  }, [spaceId]);

  const toSlug = (input: string) =>
    input.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').replace(/[^a-z0-9-]/g, '');

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplayName(val);
    if (!slugManuallyEdited) {
      setSlug(toSlug(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    setSlug(val);
    setSlugManuallyEdited(true);
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const filteredMembers = members.filter((m) => {
    if (!memberSearch) return true;
    const q = memberSearch.toLowerCase();
    return m.user?.username?.toLowerCase().includes(q) || m.user?.displayName?.toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    if (!slug.trim()) return;
    setCreating(true);
    setError('');
    try {
      const channel = await createChannel(
        spaceId,
        slug.trim(),
        displayName.trim() || undefined,
        topic.trim() || undefined,
        categoryId || undefined,
        channelType,
        isPrivate || undefined,
        isPrivate ? Array.from(selectedMembers) : undefined,
        isPrivate ? Array.from(selectedRoles) : undefined,
      );
      onClose();
      navigate(`/space/${spaceId}/channel/${channel.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create channel');
    } finally {
      setCreating(false);
    }
  };

  const nonSystemRoles = roles.filter((r: any) => !r.isSystem && !r.isDefault && !r.isGuest);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Create Channel</h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.field}>
            <label style={styles.label}>Channel Name</label>
            <div style={styles.nameInputWrapper}>
              {isPrivate ? (
                <Lock size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              ) : (
                <Hash size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              )}
              <input
                value={displayName}
                onChange={handleDisplayNameChange}
                placeholder="e.g. General Chat 🚀"
                style={styles.nameInput}
                autoFocus
                maxLength={100}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Slug</label>
            <input
              value={slug}
              onChange={handleSlugChange}
              placeholder="general-chat"
              style={styles.input}
              maxLength={100}
            />
            <span style={styles.hint}>Used in URLs — auto-generated from the name</span>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Type</label>
            <select
              value={channelType}
              onChange={(e) => setChannelType(e.target.value as ChannelType)}
              style={styles.input}
            >
              <option value="text">Text</option>
              <option value="announcement">Announcement</option>
              <option value="read_only">Read Only</option>
              <option value="forum">Forum</option>
              <option value="media_gallery">Media Gallery</option>
              <option value="route_library">Route Library</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Private Channel</label>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
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
              {nonSystemRoles.length > 0 && (
                <div style={styles.field}>
                  <label style={styles.label}>Allowed Roles</label>
                  <div style={styles.checkboxList}>
                    {nonSystemRoles.map((role: any) => (
                      <label key={role.id} style={styles.checkboxItem}>
                        <input
                          type="checkbox"
                          checked={selectedRoles.has(role.id)}
                          onChange={() => toggleRole(role.id)}
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

              <div style={styles.field}>
                <label style={styles.label}>Individual Members</label>
                <div style={styles.searchWrapper}>
                  <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search members..."
                    style={styles.searchInput}
                  />
                </div>
                <div style={styles.memberList}>
                  {filteredMembers.slice(0, 50).map((m) => (
                    <label key={m.userId} style={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        checked={selectedMembers.has(m.userId)}
                        onChange={() => toggleMember(m.userId)}
                      />
                      <Avatar src={m.user?.avatarUrl || null} name={m.user?.displayName || m.user?.username || '?'} size={20} />
                      <span>{m.user?.displayName || m.user?.username}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>@{m.user?.username}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Topic <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What's this channel about?"
              style={styles.input}
              maxLength={1024}
            />
          </div>

          {categories.length > 0 && (
            <div style={styles.field}>
              <label style={styles.label}>Category <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={styles.input}
              >
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!slug.trim() || creating}
            style={{
              ...styles.createBtn,
              opacity: !slug.trim() || creating ? 0.5 : 1,
            }}
          >
            {creating ? 'Creating...' : 'Create Channel'}
          </button>
        </div>
      </div>
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
    width: 480,
    maxWidth: '90vw',
    maxHeight: '85vh',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
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
  body: {
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    overflowY: 'auto',
    flex: 1,
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
  nameInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  },
  nameInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
  },
  input: {
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
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
  checkboxList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    maxHeight: 150,
    overflowY: 'auto',
    padding: '6px 0',
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
  memberList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxHeight: 200,
    overflowY: 'auto',
    padding: '4px 0',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '16px 20px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  cancelBtn: {
    padding: '8px 16px',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  createBtn: {
    padding: '8px 20px',
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
};
