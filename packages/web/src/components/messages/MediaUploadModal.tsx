import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Upload, ImagePlus } from 'lucide-react';

interface Props {
  existingCount: number;
  onAdd: (files: File[]) => void;
  onClose: () => void;
}

const MAX_FILES = 20;
const ACCEPT = 'image/*,video/*';

export function MediaUploadModal({ existingCount, onAdd, onClose }: Props) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const maxNew = MAX_FILES - existingCount;

  // Generate preview URLs
  useEffect(() => {
    const urls = selectedFiles.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [selectedFiles]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const addFiles = useCallback((incoming: File[]) => {
    const mediaFiles = incoming.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    setSelectedFiles((prev) => [...prev, ...mediaFiles].slice(0, maxNew));
  }, [maxNew]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (selectedFiles.length === 0) return;
    onAdd(selectedFiles);
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Add Media</h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        <div
          style={{
            ...styles.dropZone,
            borderColor: dragging ? 'var(--accent)' : 'var(--border)',
            background: dragging ? 'rgba(88, 101, 242, 0.08)' : 'var(--bg-tertiary)',
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
        >
          {selectedFiles.length === 0 ? (
            <div style={styles.dropContent}>
              <Upload size={36} style={{ color: 'var(--text-muted)' }} />
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                Drag & drop images or videos here
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                or click to browse (max {maxNew} files)
              </div>
            </div>
          ) : (
            <div style={styles.previewGrid}>
              {selectedFiles.map((file, i) => (
                <div key={i} style={styles.previewItem}>
                  {file.type.startsWith('video/') ? (
                    <video src={previews[i]} style={styles.previewThumb} preload="metadata" />
                  ) : (
                    <img src={previews[i]} alt={file.name} style={styles.previewThumb} />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    style={styles.removeBtn}
                  >
                    <X size={12} />
                  </button>
                  {file.type.startsWith('video/') && (
                    <div style={styles.videoLabel}>VIDEO</div>
                  )}
                </div>
              ))}
              {selectedFiles.length < maxNew && (
                <div style={styles.addMoreCell}>
                  <ImagePlus size={20} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Add more</span>
                </div>
              )}
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />

        <div style={styles.footer}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {selectedFiles.length} / {maxNew} files selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
            <button
              onClick={handleAdd}
              disabled={selectedFiles.length === 0}
              style={{
                ...styles.addBtn,
                opacity: selectedFiles.length === 0 ? 0.5 : 1,
              }}
            >
              Add {selectedFiles.length > 0 ? `${selectedFiles.length} Media` : 'Media'}
            </button>
          </div>
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
    zIndex: 200,
  },
  modal: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    width: '90%',
    maxWidth: 520,
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
  },
  dropZone: {
    margin: 16,
    border: '2px dashed var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    minHeight: 180,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.15s, background 0.15s',
  },
  dropContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  previewGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    width: '100%',
  },
  previewItem: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 6,
    overflow: 'hidden',
    flexShrink: 0,
  },
  previewThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  removeBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    background: 'rgba(0,0,0,0.7)',
    border: 'none',
    color: 'white',
    borderRadius: '50%',
    width: 18,
    height: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  videoLabel: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    background: 'rgba(0,0,0,0.7)',
    color: 'white',
    fontSize: '0.55rem',
    fontWeight: 700,
    padding: '1px 4px',
    borderRadius: 3,
  },
  addMoreCell: {
    width: 80,
    height: 80,
    borderRadius: 6,
    border: '2px dashed var(--border)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexShrink: 0,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '6px 14px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  addBtn: {
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    padding: '6px 16px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
};
