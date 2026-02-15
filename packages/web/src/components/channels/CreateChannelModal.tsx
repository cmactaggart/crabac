import { useState } from 'react';
import { X, Hash } from 'lucide-react';
import { useChannelsStore } from '../../stores/channels.js';
import { useNavigate } from 'react-router-dom';
import type { ChannelCategory, ChannelType } from '@crabac/shared';

interface Props {
  spaceId: string;
  categories: ChannelCategory[];
  onClose: () => void;
}

export function CreateChannelModal({ spaceId, categories, onClose }: Props) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [channelType, setChannelType] = useState<ChannelType>('text');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const createChannel = useChannelsStore((s) => s.createChannel);
  const navigate = useNavigate();

  const sanitizeName = (input: string) =>
    input.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(sanitizeName(e.target.value));
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const channel = await createChannel(
        spaceId,
        name.trim(),
        topic.trim() || undefined,
        categoryId || undefined,
        channelType,
      );
      onClose();
      navigate(`/space/${spaceId}/channel/${channel.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create channel');
    } finally {
      setCreating(false);
    }
  };

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
              <Hash size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                value={name}
                onChange={handleNameChange}
                placeholder="new-channel"
                style={styles.nameInput}
                autoFocus
                maxLength={100}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <span style={styles.hint}>Lowercase letters, numbers, and hyphens only</span>
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
            </select>
          </div>

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
            disabled={!name.trim() || creating}
            style={{
              ...styles.createBtn,
              opacity: !name.trim() || creating ? 0.5 : 1,
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
    width: 440,
    maxWidth: '90vw',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
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
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '16px 20px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
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
