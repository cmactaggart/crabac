import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import type { SpaceMember, Role } from '@gud/shared';
import { api } from '../../lib/api.js';
import { useAuthStore } from '../../stores/auth.js';
import { useSpacesStore } from '../../stores/spaces.js';
import { Avatar } from '../common/Avatar.js';

interface Props {
  spaceId: string;
  members: SpaceMember[];
}

export function MembersTab({ spaceId, members }: Props) {
  const user = useAuthStore((s) => s.user);
  const spaces = useSpacesStore((s) => s.spaces);
  const kickMember = useSpacesStore((s) => s.kickMember);
  const setMemberRoles = useSpacesStore((s) => s.setMemberRoles);
  const fetchMembers = useSpacesStore((s) => s.fetchMembers);

  const space = spaces.find((s) => s.id === spaceId);
  const [roles, setRoles] = useState<Role[]>([]);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Role[]>(`/spaces/${spaceId}/roles`).then(setRoles).catch(() => {});
  }, [spaceId]);

  const nonSystemRoles = roles.filter((r) => !r.isSystem);

  const startEditRoles = (member: SpaceMember) => {
    if (editingMember === member.userId) {
      setEditingMember(null);
      return;
    }
    setEditingMember(member.userId);
    setSelectedRoles(new Set(member.roles?.map((r) => r.id) || []));
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const handleSaveRoles = async (userId: string) => {
    setSaving(true);
    setError('');
    try {
      await setMemberRoles(spaceId, userId, Array.from(selectedRoles));
      // Re-fetch members to get updated role info
      await fetchMembers(spaceId);
      setEditingMember(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update roles');
    } finally {
      setSaving(false);
    }
  };

  const handleKick = async (userId: string) => {
    setError('');
    try {
      await kickMember(spaceId, userId);
      setConfirmKick(null);
    } catch (err: any) {
      setError(err.message || 'Failed to kick member');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {error && <div style={styles.error}>{error}</div>}
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
        {members.length} member{members.length !== 1 ? 's' : ''}
      </div>

      {members.map((member) => {
        const isOwner = member.userId === space?.ownerId;
        const isSelf = member.userId === user?.id;

        return (
          <div key={member.userId} style={styles.memberCard}>
            <div style={styles.memberRow}>
              <Avatar src={member.user?.avatarUrl || null} name={member.user?.displayName || '?'} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {member.user?.displayName}
                  {isOwner && <span style={styles.ownerBadge}>Owner</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{member.user?.username}</div>
              </div>

              {/* Role badges */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {member.roles?.map((r) => (
                  <span key={r.id} style={{ ...styles.roleBadge, borderColor: r.color || 'var(--border)', color: r.color || 'var(--text-secondary)' }}>
                    {r.name}
                  </span>
                ))}
              </div>

              {!isOwner && !isSelf && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => startEditRoles(member)} style={styles.editBtn}>Roles</button>
                  {confirmKick === member.userId ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleKick(member.userId)} style={styles.confirmDeleteBtn}>Kick</button>
                      <button onClick={() => setConfirmKick(null)} style={styles.cancelKickBtn}>No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmKick(member.userId)} style={styles.trashBtn} title="Kick member">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {editingMember === member.userId && (
              <div style={styles.roleEdit}>
                <div style={styles.roleCheckboxes}>
                  {nonSystemRoles.map((role) => (
                    <label key={role.id} style={styles.roleCheckbox}>
                      <input
                        type="checkbox"
                        checked={selectedRoles.has(role.id)}
                        onChange={() => toggleRole(role.id)}
                      />
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: role.color || 'var(--text-muted)' }} />
                      <span>{role.name}</span>
                    </label>
                  ))}
                  {nonSystemRoles.length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No custom roles created yet
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditingMember(null)} style={styles.cancelKickBtn}>Cancel</button>
                  <button onClick={() => handleSaveRoles(member.userId)} disabled={saving} style={styles.saveBtn}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  memberCard: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
  },
  ownerBadge: {
    fontSize: '0.65rem',
    background: 'var(--accent)',
    color: 'white',
    padding: '1px 6px',
    borderRadius: 'var(--radius)',
    marginLeft: 6,
    fontWeight: 600,
  },
  roleBadge: {
    fontSize: '0.7rem',
    padding: '1px 8px',
    borderRadius: 10,
    border: '1px solid',
    fontWeight: 500,
  },
  editBtn: {
    padding: '4px 10px',
    background: 'var(--bg-tertiary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  trashBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 'var(--radius)',
  },
  confirmDeleteBtn: {
    padding: '4px 10px',
    background: 'var(--danger)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  cancelKickBtn: {
    padding: '4px 10px',
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.75rem',
  },
  roleEdit: {
    padding: '8px 12px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  roleCheckboxes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '4px 14px',
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
    marginBottom: 8,
  },
};
