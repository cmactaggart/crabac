import { useState, useEffect } from 'react';
import { Permissions } from '@gud/shared';
import type { Role, ChannelPermissionOverride, PermissionKey } from '@gud/shared';
import { api } from '../../lib/api.js';

interface Props {
  spaceId: string;
  channelId: string;
}

type TriState = 'inherit' | 'allow' | 'deny';

const CHANNEL_PERMISSIONS: { key: PermissionKey; label: string }[] = [
  { key: 'VIEW_CHANNELS', label: 'View Channel' },
  { key: 'SEND_MESSAGES', label: 'Send Messages' },
  { key: 'MANAGE_MESSAGES', label: 'Manage Messages' },
  { key: 'ATTACH_FILES', label: 'Attach Files' },
  { key: 'ADD_REACTIONS', label: 'Add Reactions' },
];

export function ChannelPermissionsEditor({ spaceId, channelId }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [overrides, setOverrides] = useState<ChannelPermissionOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [rolesData, overridesData] = await Promise.all([
          api<Role[]>(`/spaces/${spaceId}/roles`),
          api<ChannelPermissionOverride[]>(`/spaces/${spaceId}/channels/${channelId}/overrides`),
        ]);
        setRoles(rolesData.filter((r) => !r.isSystem || r.isDefault).sort((a, b) => b.position - a.position));
        setOverrides(overridesData);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [spaceId, channelId]);

  const getOverride = (roleId: string) => overrides.find((o) => o.roleId === roleId);

  const getTriState = (roleId: string, permKey: PermissionKey): TriState => {
    const ov = getOverride(roleId);
    if (!ov) return 'inherit';
    const bit = Permissions[permKey];
    const allow = BigInt(ov.allow);
    const deny = BigInt(ov.deny);
    if ((allow & bit) !== 0n) return 'allow';
    if ((deny & bit) !== 0n) return 'deny';
    return 'inherit';
  };

  const cycleTriState = async (roleId: string, permKey: PermissionKey) => {
    const current = getTriState(roleId, permKey);
    const bit = Permissions[permKey];
    const ov = getOverride(roleId);
    let allow = ov ? BigInt(ov.allow) : 0n;
    let deny = ov ? BigInt(ov.deny) : 0n;

    // Cycle: inherit → allow → deny → inherit
    if (current === 'inherit') {
      allow |= bit;
      deny &= ~bit;
    } else if (current === 'allow') {
      allow &= ~bit;
      deny |= bit;
    } else {
      allow &= ~bit;
      deny &= ~bit;
    }

    setSaving(true);
    try {
      const updated = await api<ChannelPermissionOverride[]>(
        `/spaces/${spaceId}/channels/${channelId}/overrides/${roleId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ allow: allow.toString(), deny: deny.toString() }),
        },
      );
      setOverrides(updated);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading overrides...</div>;

  if (roles.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No roles to configure.</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Role</th>
            {CHANNEL_PERMISSIONS.map((p) => (
              <th key={p.key} style={styles.th}>{p.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id}>
              <td style={styles.td}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: role.color || 'var(--text-muted)', flexShrink: 0 }} />
                  {role.name}
                </span>
              </td>
              {CHANNEL_PERMISSIONS.map((p) => {
                const state = getTriState(role.id, p.key);
                return (
                  <td key={p.key} style={styles.td}>
                    <button
                      onClick={() => cycleTriState(role.id, p.key)}
                      disabled={saving}
                      style={{
                        ...styles.triBtn,
                        background: state === 'allow' ? 'rgba(67, 181, 129, 0.2)' : state === 'deny' ? 'rgba(237, 66, 69, 0.2)' : 'var(--bg-tertiary)',
                        color: state === 'allow' ? 'var(--success, #43b581)' : state === 'deny' ? 'var(--danger)' : 'var(--text-muted)',
                        borderColor: state === 'allow' ? 'var(--success, #43b581)' : state === 'deny' ? 'var(--danger)' : 'var(--border)',
                      }}
                      title={`${state} (click to cycle)`}
                    >
                      {state === 'allow' ? '\u2713' : state === 'deny' ? '\u2717' : '\u2014'}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8 }}>
        Click to cycle: Inherit (\u2014) \u2192 Allow (\u2713) \u2192 Deny (\u2717) \u2192 Inherit
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8rem',
  },
  th: {
    textAlign: 'left',
    padding: '6px 8px',
    fontWeight: 700,
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '4px 8px',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  },
  triBtn: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 700,
  },
};
