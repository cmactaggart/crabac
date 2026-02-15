import { useState, useRef, useCallback } from 'react';
import { X, Upload, ImagePlus } from 'lucide-react';
import { api } from '../../lib/api.js';
import type { GalleryItem } from '@crabac/shared';

interface Props {
  channelId: string;
  onClose: () => void;
  onComplete: () => void;
}

const MAX_FILES = 20;
const MAX_NON_VIDEO_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const BATCH_SIZE = 4;

export function GalleryUploadModal({ channelId, onClose, onComplete }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isVideo = (file: File) =>
    file.type.startsWith('video/') || /\.(mp4|mov|webm|ogg|ogv|avi|mkv)$/i.test(file.name);

  const addFiles = useCallback((incoming: File[]) => {
    setError('');
    const valid = incoming.filter((f) => {
      const maxSize = isVideo(f) ? MAX_VIDEO_SIZE : MAX_NON_VIDEO_SIZE;
      if (f.size > maxSize) {
        setError(`"${f.name}" is too large (max ${isVideo(f) ? '100MB' : '10MB'})`);
        return false;
      }
      return true;
    });
    setFiles((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_FILES) {
        setError(`Maximum ${MAX_FILES} files per upload`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError('');

    try {
      // First batch creates the item
      const firstBatch = files.slice(0, BATCH_SIZE);
      const formData = new FormData();
      for (const file of firstBatch) {
        formData.append('files', file);
      }
      if (caption.trim()) {
        formData.append('caption', caption.trim());
      }

      setProgress(`Uploading batch 1/${Math.ceil(files.length / BATCH_SIZE)}...`);
      const item = await api<GalleryItem>(`/channels/${channelId}/gallery/upload`, {
        method: 'POST',
        body: formData,
      });

      // Remaining batches add attachments to the item
      for (let i = BATCH_SIZE; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchForm = new FormData();
        for (const file of batch) {
          batchForm.append('files', file);
        }

        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(files.length / BATCH_SIZE);
        setProgress(`Uploading batch ${batchNum + 1}/${totalBatches}...`);

        await api(`/channels/${channelId}/gallery/${item.id}/attachments`, {
          method: 'POST',
          body: batchForm,
        });
      }

      onComplete();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Upload Media</h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          <div
            style={{
              ...styles.dropZone,
              borderColor: dragOver ? 'var(--accent)' : 'var(--border)',
              background: dragOver ? 'rgba(88, 101, 242, 0.08)' : 'var(--bg-secondary)',
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <ImagePlus size={32} style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Drop images or videos here, or click to browse
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Max 10MB per image, 100MB per video, up to {MAX_FILES} files
            </span>
          </div>

          {files.length > 0 && (
            <div style={styles.previewGrid}>
              {files.map((file, idx) => (
                <div key={idx} style={styles.previewItem}>
                  {file.type.startsWith('video/') ? (
                    <video
                      src={URL.createObjectURL(file)}
                      style={styles.previewThumb}
                      muted
                    />
                  ) : (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      style={styles.previewThumb}
                    />
                  )}
                  <button
                    onClick={() => removeFile(idx)}
                    style={styles.removeBtn}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Caption (optional)</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption..."
              style={styles.textarea}
              maxLength={2000}
              rows={2}
            />
          </div>
        </div>

        <div style={styles.footer}>
          {progress && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{progress}</span>}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            style={{
              ...styles.uploadBtn,
              opacity: files.length === 0 || uploading ? 0.5 : 1,
            }}
          >
            <Upload size={14} />
            {uploading ? 'Uploading...' : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
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
    width: 520,
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
    gap: 14,
    overflowY: 'auto',
    flex: 1,
  },
  dropZone: {
    border: '2px dashed var(--border)',
    borderRadius: 'var(--radius)',
    padding: '28px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: 6,
  },
  previewItem: {
    position: 'relative',
    aspectRatio: '1',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
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
    color: '#fff',
    borderRadius: '50%',
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
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
  textarea: {
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
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
  uploadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
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
