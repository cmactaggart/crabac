import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Plus, Copy, Check, X } from 'lucide-react';
import type { Invite } from '@gud/shared';
import { api } from '../../lib/api.js';
import { useQRCode } from '../../lib/qrcode.js';

interface Props {
  spaceId: string;
}

export function InvitesTab({ spaceId }: Props) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState(168);
  const [maxUses, setMaxUses] = useState(0);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const qrLink = qrCode ? `${window.location.origin}/invite/${qrCode}` : null;
  const qrDataUrl = useQRCode(qrLink);

  const fetchInvites = async () => {
    try {
      const data = await api<Invite[]>(`/spaces/${spaceId}/invites`);
      setInvites(data);
    } catch {
      setError('Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvites(); }, [spaceId]);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const body: any = {};
      if (expiresInHours > 0) body.expiresInHours = expiresInHours;
      if (maxUses > 0) body.maxUses = maxUses;

      const invite = await api<Invite>(`/spaces/${spaceId}/invites`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setInvites((prev) => [invite, ...prev]);
      setShowCreate(false);
      setQrCode(invite.code);
    } catch (err: any) {
      setError(err.message || 'Failed to create invite');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (inviteId: string) => {
    setError('');
    try {
      await api(`/spaces/${spaceId}/invites/${inviteId}`, { method: 'DELETE' });
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      setConfirmDelete(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete invite');
    }
  };

  const copyLink = (code: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never';
    const d = new Date(expiresAt);
    if (d < new Date()) return 'Expired';
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading invites...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && <div style={styles.error}>{error}</div>}

      <button onClick={() => setShowCreate(!showCreate)} style={styles.addBtn}>
        <Plus size={14} /> Create Invite
      </button>

      {showCreate && (
        <div style={styles.createForm}>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={styles.formLabel}>
              Expires after
              <select value={expiresInHours} onChange={(e) => setExpiresInHours(Number(e.target.value))} style={styles.select}>
                <option value={1}>1 hour</option>
                <option value={24}>24 hours</option>
                <option value={168}>7 days</option>
                <option value={720}>30 days</option>
                <option value={0}>Never</option>
              </select>
            </label>
            <label style={styles.formLabel}>
              Max uses
              <select value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} style={styles.select}>
                <option value={0}>No limit</option>
                <option value={1}>1</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>
          <button onClick={handleCreate} disabled={creating} style={styles.createBtn}>
            {creating ? 'Creating...' : 'Generate Link'}
          </button>
        </div>
      )}

      {invites.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
          No invites yet
        </div>
      )}

      {invites.map((invite) => {
        const expired = invite.expiresAt && new Date(invite.expiresAt) < new Date();
        return (
          <div key={invite.id} style={{ ...styles.inviteRow, opacity: expired ? 0.5 : 1 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={styles.code} onClick={() => setQrCode(invite.code)} role="button" tabIndex={0}>{invite.code}</code>
                <button onClick={() => copyLink(invite.code, invite.id)} style={styles.copyBtn} title="Copy link">
                  {copiedId === invite.id ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div style={styles.meta}>
                Uses: {invite.useCount}{invite.maxUses ? `/${invite.maxUses}` : ''} &middot; Expires: {formatExpiry(invite.expiresAt)}
              </div>
            </div>

            {confirmDelete === invite.id ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => handleDelete(invite.id)} style={styles.confirmDeleteBtn}>Delete</button>
                <button onClick={() => setConfirmDelete(null)} style={styles.smallCancel}>No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(invite.id)} style={styles.trashBtn} title="Delete invite">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      })}

      {qrCode && createPortal(
        <div style={styles.qrOverlay} onClick={() => setQrCode(null)}>
          <div style={styles.qrCard} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setQrCode(null)} style={styles.qrClose}>
              <X size={20} />
            </button>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Invite QR Code" style={styles.qrImage} />
            ) : (
              <div style={{ padding: 40, color: 'var(--text-muted)' }}>Generating...</div>
            )}
            <div style={styles.qrLink}>{qrLink}</div>
            <button
              onClick={() => { copyLink(qrCode, '__qr'); }}
              style={styles.qrCopyBtn}
            >
              {copiedId === '__qr' ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>,
        document.body,
      )}
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
    flexDirection: 'column',
    gap: 12,
    padding: '12px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
  },
  formLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    flex: 1,
  },
  select: {
    padding: '6px 10px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  createBtn: {
    padding: '8px 16px',
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  inviteRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  },
  code: {
    fontSize: '0.85rem',
    background: 'var(--bg-tertiary)',
    padding: '2px 8px',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  copyBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 2,
  },
  meta: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: 4,
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
    whiteSpace: 'nowrap',
  },
  smallCancel: {
    padding: '4px 10px',
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
  qrOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  qrCard: {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
    maxWidth: 380,
    width: '90%',
  },
  qrClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
  },
  qrImage: {
    width: '100%',
    maxWidth: 320,
    height: 'auto',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-primary)',
  },
  qrLink: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    wordBreak: 'break-all',
    textAlign: 'center',
  },
  qrCopyBtn: {
    padding: '8px 24px',
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
};
