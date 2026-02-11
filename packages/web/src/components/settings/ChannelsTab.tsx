import { useState } from 'react';
import { Trash2, Plus, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import type { Channel, ChannelCategory, ChannelType } from '@gud/shared';
import { useChannelsStore } from '../../stores/channels.js';
import { ChannelPermissionsEditor } from './ChannelPermissionsEditor.js';

interface Props {
  spaceId: string;
  channels: Channel[];
  categories: ChannelCategory[];
}

export function ChannelsTab({ spaceId, channels, categories }: Props) {
  const createChannel = useChannelsStore((s) => s.createChannel);
  const createCategory = useChannelsStore((s) => s.createCategory);
  const updateChannel = useChannelsStore((s) => s.updateChannel);
  const deleteChannel = useChannelsStore((s) => s.deleteChannel);
  const updateCategory = useChannelsStore((s) => s.updateCategory);
  const deleteCategory = useChannelsStore((s) => s.deleteCategory);

  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelCategory, setNewChannelCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [editType, setEditType] = useState<ChannelType>('text');
  const [editCatName, setEditCatName] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const uncategorized = channels.filter((ch) => !ch.categoryId);
  const byCategory = new Map<string, Channel[]>();
  for (const ch of channels) {
    if (ch.categoryId) {
      const list = byCategory.get(ch.categoryId) || [];
      list.push(ch);
      byCategory.set(ch.categoryId, list);
    }
  }

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    setError('');
    try {
      await createChannel(spaceId, newChannelName.trim(), undefined, newChannelCategory || undefined);
      setNewChannelName('');
      setNewChannelCategory('');
      setShowNewChannel(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create channel');
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setError('');
    try {
      await createCategory(spaceId, newCategoryName.trim());
      setNewCategoryName('');
      setShowNewCategory(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
    }
  };

  const handleSaveChannel = async (ch: Channel) => {
    setError('');
    try {
      await updateChannel(spaceId, ch.id, { name: editName.trim(), topic: editTopic.trim(), type: editType });
      setEditingChannel(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update channel');
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    setError('');
    try {
      await deleteChannel(spaceId, channelId);
      setConfirmDelete(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete channel');
    }
  };

  const handleSaveCategory = async (catId: string) => {
    setError('');
    try {
      await updateCategory(spaceId, catId, { name: editCatName.trim() });
      setEditingCategory(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    setError('');
    try {
      await deleteCategory(spaceId, catId);
      setConfirmDelete(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete category');
    }
  };

  const startEditChannel = (ch: Channel) => {
    setEditingChannel(ch.id);
    setEditName(ch.name);
    setEditTopic(ch.topic || '');
    setEditType(ch.type);
  };

  const renderChannelRow = (ch: Channel) => {
    if (editingChannel === ch.id) {
      return (
        <div key={ch.id} style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div style={styles.editRow}>
            {ch.isAdmin ? (
              <span style={{ ...styles.input, opacity: 0.5 }}>admin (read-only)</span>
            ) : (
              <input value={editName} onChange={(e) => setEditName(e.target.value)} style={styles.input} placeholder="Name" />
            )}
            <input value={editTopic} onChange={(e) => setEditTopic(e.target.value)} style={styles.input} placeholder="Topic" />
            <select value={editType} onChange={(e) => setEditType(e.target.value as ChannelType)} style={styles.select}>
              <option value="text">Text</option>
              <option value="announcement">Announcement</option>
              <option value="read_only">Read Only</option>
            </select>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => handleSaveChannel(ch)} style={styles.smallSave} disabled={!editName.trim()}>Save</button>
              <button onClick={() => setEditingChannel(null)} style={styles.smallCancel}>Cancel</button>
            </div>
          </div>
          <div style={{ padding: '8px 12px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
              Permission Overrides
            </div>
            <ChannelPermissionsEditor spaceId={spaceId} channelId={ch.id} />
          </div>
        </div>
      );
    }

    return (
      <div key={ch.id} style={styles.itemRow}>
        {ch.isAdmin ? (
          <Shield size={14} style={{ color: 'var(--warning, #f0b232)', flexShrink: 0 }} />
        ) : (
          <span style={styles.hash}>#</span>
        )}
        <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => startEditChannel(ch)}>{ch.name}</span>
        {ch.isAdmin && <span style={styles.typeLabel}>admin</span>}
        <span style={styles.typeLabel}>{ch.type}</span>
        {!ch.isAdmin && (
          confirmDelete === `ch-${ch.id}` ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => handleDeleteChannel(ch.id)} style={styles.confirmDeleteBtn}>Delete</button>
              <button onClick={() => setConfirmDelete(null)} style={styles.smallCancel}>No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(`ch-${ch.id}`)} style={styles.trashBtn} title="Delete channel">
              <Trash2 size={14} />
            </button>
          )
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <div style={styles.error}>{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setShowNewChannel(!showNewChannel)} style={styles.addBtn}>
          <Plus size={14} /> Channel
        </button>
        <button onClick={() => setShowNewCategory(!showNewCategory)} style={styles.addBtn}>
          <Plus size={14} /> Category
        </button>
      </div>

      {showNewChannel && (
        <div style={styles.newForm}>
          <input
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            placeholder="Channel name"
            style={styles.input}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
          />
          <select value={newChannelCategory} onChange={(e) => setNewChannelCategory(e.target.value)} style={styles.select}>
            <option value="">No category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <button onClick={handleCreateChannel} style={styles.smallSave} disabled={!newChannelName.trim()}>Create</button>
        </div>
      )}

      {showNewCategory && (
        <div style={styles.newForm}>
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Category name"
            style={styles.input}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
          />
          <button onClick={handleCreateCategory} style={styles.smallSave} disabled={!newCategoryName.trim()}>Create</button>
        </div>
      )}

      {/* Categories with their channels */}
      {categories.map((cat) => {
        const catChannels = byCategory.get(cat.id) || [];
        return (
          <div key={cat.id} style={styles.categorySection}>
            <div style={styles.categoryHeader}>
              {editingCategory === cat.id ? (
                <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                  <input value={editCatName} onChange={(e) => setEditCatName(e.target.value)} style={styles.input} />
                  <button onClick={() => handleSaveCategory(cat.id)} style={styles.smallSave} disabled={!editCatName.trim()}>Save</button>
                  <button onClick={() => setEditingCategory(null)} style={styles.smallCancel}>Cancel</button>
                </div>
              ) : (
                <>
                  <span
                    style={{ flex: 1, cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}
                    onClick={() => { setEditingCategory(cat.id); setEditCatName(cat.name); }}
                  >
                    {cat.name}
                  </span>
                  {confirmDelete === `cat-${cat.id}` ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleDeleteCategory(cat.id)} style={styles.confirmDeleteBtn}>Delete</button>
                      <button onClick={() => setConfirmDelete(null)} style={styles.smallCancel}>No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(`cat-${cat.id}`)} style={styles.trashBtn} title="Delete category">
                      <Trash2 size={14} />
                    </button>
                  )}
                </>
              )}
            </div>
            {catChannels.map(renderChannelRow)}
            {catChannels.length === 0 && (
              <div style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No channels
              </div>
            )}
          </div>
        );
      })}

      {/* Uncategorized channels */}
      {uncategorized.length > 0 && (
        <div style={styles.categorySection}>
          <div style={styles.categoryHeader}>
            <span style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Uncategorized
            </span>
          </div>
          {uncategorized.map(renderChannelRow)}
        </div>
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
  },
  newForm: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
  },
  input: {
    padding: '6px 10px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
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
  categorySection: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    gap: 8,
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderTop: '1px solid var(--border)',
    fontSize: '0.875rem',
  },
  editRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    padding: '8px 12px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  hash: {
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  typeLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    background: 'var(--bg-tertiary)',
    padding: '2px 6px',
    borderRadius: 'var(--radius)',
  },
  trashBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 'var(--radius)',
  },
  smallSave: {
    padding: '4px 12px',
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
    padding: '4px 10px',
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
  },
  confirmDeleteBtn: {
    padding: '4px 10px',
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
