import { useState, useRef } from 'react';
import { X, Paperclip, Library } from 'lucide-react';
import { TabbedCollectionPicker } from '../common/TabbedCollectionPicker.js';
import type { CollectionPickerItem } from '../common/TabbedCollectionPicker.js';

interface CollectionItem { type: string; id: string; label?: string }

interface Props {
  onSubmit: (data: { title: string; content: string }, files: File[], collectionItems: CollectionItem[]) => Promise<void>;
  onClose: () => void;
  spaceId?: string;
}

export function CreateThreadModal({ onSubmit, onClose, spaceId }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setCreating(true);
    setError('');
    try {
      await onSubmit({ title: title.trim(), content: content.trim() }, files, collectionItems);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create thread');
    } finally {
      setCreating(false);
    }
  };

  const handleCollectionSelect = (items: CollectionPickerItem[]) => {
    setCollectionItems((prev) => [...prev, ...items.map((i) => ({ type: i.type, id: i.id }))]);
    setShowPicker(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected].slice(0, 20));
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>New Thread</h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.field}>
            <label style={styles.label}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thread title"
              style={styles.input}
              autoFocus
              maxLength={200}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What do you want to discuss?"
              style={styles.textarea}
              rows={6}
              maxLength={4000}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Attachments</label>
            <input
              ref={fileRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={styles.attachBtn}
              >
                <Paperclip size={14} />
                Upload files
              </button>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                style={styles.attachBtn}
              >
                <Library size={14} />
                From Collections
              </button>
            </div>
            {files.length > 0 && (
              <div style={styles.fileList}>
                {files.map((f, i) => (
                  <div key={i} style={styles.fileItem}>
                    {f.type.startsWith('image/') && (
                      <img
                        src={URL.createObjectURL(f)}
                        alt=""
                        style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }}
                      />
                    )}
                    <span style={styles.fileName}>{f.name}</span>
                    <span style={styles.fileSize}>({(f.size / 1024).toFixed(0)} KB)</span>
                    <button onClick={() => removeFile(i)} style={styles.removeFileBtn}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            {collectionItems.length > 0 && (
              <div style={styles.fileList}>
                {collectionItems.map((item, i) => (
                  <div key={`col-${i}`} style={styles.fileItem}>
                    <span style={{ fontSize: '0.65rem', padding: '1px 5px', background: 'var(--accent)', color: '#fff', borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>
                      {item.type === 'route' ? 'Route' : item.type === 'event' ? 'Event' : 'Photo'}
                    </span>
                    <span style={styles.fileName}>{item.label || item.id}</span>
                    <button onClick={() => setCollectionItems((prev) => prev.filter((_, j) => j !== i))} style={styles.removeFileBtn}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !content.trim() || creating}
            style={{
              ...styles.createBtn,
              opacity: !title.trim() || !content.trim() || creating ? 0.5 : 1,
            }}
          >
            {creating ? 'Creating...' : 'Create Thread'}
          </button>
        </div>
      </div>
      {showPicker && (
        <TabbedCollectionPicker
          spaceId={spaceId}
          onSelect={handleCollectionSelect}
          onClose={() => setShowPicker(false)}
        />
      )}
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
    width: 520,
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
  textarea: {
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  attachBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    width: 'fit-content',
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 4,
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    background: 'var(--bg-tertiary)',
    borderRadius: 4,
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  fileName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 200,
  },
  fileSize: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  removeFileBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
    marginLeft: 'auto',
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
