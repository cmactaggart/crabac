import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useQRCode } from '../../lib/qrcode.js';

interface Props {
  spaceId: string;
  onClose: () => void;
}

export function InviteModal({ spaceId, onClose }: Props) {
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiresInHours, setExpiresInHours] = useState(168); // 7 days
  const [maxUses, setMaxUses] = useState(0); // 0 = unlimited
  const qrDataUrl = useQRCode(link || null);

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      const body: any = {};
      if (expiresInHours > 0) body.expiresInHours = expiresInHours;
      if (maxUses > 0) body.maxUses = maxUses;

      const invite = await api<any>(`/spaces/${spaceId}/invites`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const url = `${window.location.origin}/invite/${invite.code}`;
      setLink(url);
    } catch (err: any) {
      setError(err.message || 'Failed to create invite');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={styles.modal}>
        <h2 style={styles.title}>Invite People</h2>

        {error && <div style={styles.error}>{error}</div>}

        {link ? (
          <>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Invite QR Code" style={styles.qrImage} />
            ) : (
              <div style={{ padding: 40, color: 'var(--text-muted)', textAlign: 'center' }}>Generating QR...</div>
            )}
            <p style={styles.qrHint}>Scan to join, or share the link below</p>
            <div style={styles.linkRow}>
              <input value={link} readOnly style={styles.linkInput} onFocus={(e) => e.target.select()} />
              <button onClick={handleCopy} style={styles.copyBtn}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button onClick={() => setLink('')} style={styles.secondaryBtn}>
              Create another
            </button>
          </>
        ) : (
          <>
            <div style={styles.options}>
              <label style={styles.label}>
                Expires after
                <select
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  style={styles.select}
                >
                  <option value={1}>1 hour</option>
                  <option value={24}>24 hours</option>
                  <option value={168}>7 days</option>
                  <option value={720}>30 days</option>
                  <option value={0}>Never</option>
                </select>
              </label>
              <label style={styles.label}>
                Max uses
                <select
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                  style={styles.select}
                >
                  <option value={0}>No limit</option>
                  <option value={1}>1 use</option>
                  <option value={5}>5 uses</option>
                  <option value={10}>10 uses</option>
                  <option value={25}>25 uses</option>
                  <option value={50}>50 uses</option>
                  <option value={100}>100 uses</option>
                </select>
              </label>
            </div>
            <button onClick={handleCreate} disabled={loading} style={styles.primaryBtn}>
              {loading ? 'Creating...' : 'Generate Invite Link'}
            </button>
          </>
        )}

        <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
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
    background: 'var(--bg-secondary)',
    padding: '2rem',
    borderRadius: 'var(--radius)',
    width: '100%',
    maxWidth: '440px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    position: 'relative',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
  },
  text: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
  },
  linkRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  linkInput: {
    flex: 1,
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  copyBtn: {
    padding: '0.6rem 1rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  options: {
    display: 'flex',
    gap: '1rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    flex: 1,
  },
  select: {
    padding: '0.5rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
  },
  primaryBtn: {
    padding: '0.7rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '0.5rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '1.5rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  qrImage: {
    width: '100%',
    maxWidth: 280,
    height: 'auto',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-primary)',
    alignSelf: 'center',
  },
  qrHint: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
};
