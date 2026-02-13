import { useState, useEffect } from 'react';
import { Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { Permissions } from '@crabac/shared';
import type { Role, PermissionKey } from '@crabac/shared';
import { api } from '../../lib/api.js';

interface Props {
  spaceId: string;
}

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  VIEW_CHANNELS: 'View Channels',
  SEND_MESSAGES: 'Send Messages',
  MANAGE_MESSAGES: 'Manage Messages',
  ATTACH_FILES: 'Attach Files',
  ADD_REACTIONS: 'Add Reactions',
  MANAGE_CHANNELS: 'Manage Channels',
  MANAGE_ROLES: 'Manage Roles',
  MANAGE_MEMBERS: 'Manage Members',
  MANAGE_SPACE: 'Manage Space',
  CREATE_INVITES: 'Create Invites',
  MANAGE_INVITES: 'Manage Invites',
  ADMINISTRATOR: 'Administrator',
  VIEW_ADMIN_CHANNEL: 'View Admin Channel',
  CREATE_PORTAL: 'Create Portal',
  SUBMIT_PORTAL_INVITE: 'Submit Portal Invite',
  ACCEPT_PORTAL_INVITE: 'Accept Portal Invite',
  VIEW_ROLES: 'View Roles',
  MANAGE_THREADS: 'Manage Threads',
  CREATE_THREADS: 'Create Threads',
  MANAGE_CALENDAR: 'Manage Calendar',
};

export function RolesTab({ spaceId }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#5865f2');
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editPerms, setEditPerms] = useState(0n);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchRoles = async () => {
    try {
      const data = await api<Role[]>(`/spaces/${spaceId}/roles`);
      setRoles(data.sort((a, b) => b.position - a.position));
    } catch {
      setError('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, [spaceId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setError('');
    try {
      const role = await api<Role>(`/spaces/${spaceId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      setRoles((prev) => [...prev, role].sort((a, b) => b.position - a.position));
      setNewName('');
      setNewColor('#5865f2');
      setShowCreate(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create role');
    }
  };

  const startEdit = (role: Role) => {
    if (expandedRole === role.id) {
      setExpandedRole(null);
      return;
    }
    setExpandedRole(role.id);
    setEditName(role.name);
    setEditColor(role.color || '#5865f2');
    setEditPerms(BigInt(role.permissions));
  };

  const togglePerm = (perm: bigint) => {
    setEditPerms((prev) => (prev & perm) !== 0n ? prev & ~perm : prev | perm);
  };

  const handleSave = async (roleId: string) => {
    setSaving(true);
    setError('');
    try {
      const updated = await api<Role>(`/spaces/${spaceId}/roles/${roleId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          color: editColor,
          permissions: editPerms.toString(),
        }),
      });
      setRoles((prev) => prev.map((r) => (r.id === roleId ? updated : r)));
      setExpandedRole(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (roleId: string) => {
    setError('');
    try {
      await api(`/spaces/${spaceId}/roles/${roleId}`, { method: 'DELETE' });
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      setConfirmDelete(null);
      if (expandedRole === roleId) setExpandedRole(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete role');
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading roles...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && <div style={styles.error}>{error}</div>}

      <button onClick={() => setShowCreate(!showCreate)} style={styles.addBtn}>
        <Plus size={14} /> Create Role
      </button>

      {showCreate && (
        <div style={styles.createForm}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Role name"
            style={styles.input}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            style={styles.colorInput}
          />
          <button onClick={handleCreate} style={styles.smallSave} disabled={!newName.trim()}>Create</button>
        </div>
      )}

      {roles.map((role) => (
        <div key={role.id} style={styles.roleCard}>
          <div style={styles.roleHeader} onClick={() => {
            const isOwnerRole = role.isSystem && !role.isDefault;
            if (!isOwnerRole) startEdit(role);
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <span style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: role.color || 'var(--text-muted)',
                flexShrink: 0,
              }} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{role.name}</span>
              {role.isSystem && !role.isDefault && <span style={styles.badge}>System</span>}
              {role.isDefault && <span style={styles.badge}>Default</span>}
            </div>
            {!(role.isSystem && !role.isDefault) && (
              <span style={{ color: 'var(--text-muted)' }}>
                {expandedRole === role.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
            )}
          </div>

          {expandedRole === role.id && !(role.isSystem && !role.isDefault) && (
            <div style={styles.roleEdit}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Name</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} style={styles.input} />
                </div>
                <div>
                  <label style={styles.label}>Color</label>
                  <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} style={styles.colorInput} />
                </div>
              </div>

              <div>
                <label style={styles.label}>Permissions</label>
                <div style={styles.permGrid}>
                  {(Object.entries(Permissions) as [PermissionKey, bigint][]).map(([key, val]) => (
                    <label key={key} style={styles.permItem}>
                      <input
                        type="checkbox"
                        checked={(editPerms & val) !== 0n}
                        onChange={() => togglePerm(val)}
                      />
                      <span>{PERMISSION_LABELS[key]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {role.isDefault ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Applied to all members
                  </span>
                ) : confirmDelete === role.id ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleDelete(role.id)} style={styles.confirmDeleteBtn}>Confirm Delete</button>
                    <button onClick={() => setConfirmDelete(null)} style={styles.smallCancel}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(role.id)} style={styles.trashBtn}>
                    <Trash2 size={14} /> Delete
                  </button>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setExpandedRole(null)} style={styles.smallCancel}>Cancel</button>
                  <button onClick={() => handleSave(role.id)} disabled={saving || !editName.trim()} style={styles.smallSave}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    background: 'var(--bg-tertiary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  createForm: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
  },
  roleCard: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
  },
  roleHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    cursor: 'pointer',
  },
  roleEdit: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '12px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  label: {
    display: 'block',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    marginBottom: 4,
  },
  input: {
    padding: '6px 10px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  colorInput: {
    width: 36,
    height: 32,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'none',
    cursor: 'pointer',
    padding: 2,
  },
  permGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 6,
  },
  permItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  badge: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    background: 'var(--bg-tertiary)',
    padding: '1px 6px',
    borderRadius: 'var(--radius)',
  },
  smallSave: {
    padding: '6px 14px',
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  smallCancel: {
    padding: '6px 12px',
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
  },
  trashBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'none',
    border: 'none',
    color: 'var(--danger)',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
  },
  confirmDeleteBtn: {
    padding: '6px 12px',
    background: 'var(--danger)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
};
