import { useState, useRef } from 'react';
import { X, Eye, EyeOff, Upload } from 'lucide-react';
import type { BlogPost } from '@crabac/shared';
import { useBlogStore } from '../../stores/blog.js';
import { Markdown } from '../common/Markdown.js';

interface Props {
  spaceId: string;
  editPost: BlogPost | null;
  onClose: () => void;
}

export function BlogPostEditor({ spaceId, editPost, onClose }: Props) {
  const { createPost, updatePost, uploadImage } = useBlogStore();
  const [title, setTitle] = useState(editPost?.title || '');
  const [summary, setSummary] = useState(editPost?.summary || '');
  const [content, setContent] = useState(editPost?.content || '');
  const [isPublic, setIsPublic] = useState(editPost?.isPublic || false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async (status: 'draft' | 'published') => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editPost) {
        await updatePost(spaceId, editPost.id, { title: title.trim(), summary: summary.trim() || null, content, status, isPublic });
      } else {
        await createPost(spaceId, { title: title.trim(), summary: summary.trim() || undefined, content, status, isPublic });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      const url = await uploadImage(spaceId, file);
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = content;
        const insert = `![${file.name}](${url})`;
        setContent(text.slice(0, start) + insert + text.slice(end));
      } else {
        setContent((prev) => prev + `\n![${file.name}](${url})`);
      }
    } catch {
      setError('Image upload failed');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = '';
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{editPost ? 'Edit Post' : 'New Post'}</h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.modalBody}>
          <div style={styles.field}>
            <label style={styles.label}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={styles.input}
              maxLength={500}
              placeholder="Post title"
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={styles.label}>Summary</label>
              <span style={{ fontSize: '0.7rem', color: summary.length > 120 ? 'var(--danger)' : 'var(--text-muted)' }}>{summary.length}/140</span>
            </div>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              style={styles.input}
              maxLength={140}
              placeholder="Brief summary (optional, shown in list)"
            />
          </div>

          <div style={styles.field}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={styles.label}>Content (Markdown)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={styles.toolBtn}
                  title="Upload Image"
                >
                  <Upload size={14} /> Image
                </button>
                <button
                  onClick={() => setPreview((p) => !p)}
                  style={styles.toolBtn}
                >
                  {preview ? <EyeOff size={14} /> : <Eye size={14} />}
                  {preview ? 'Edit' : 'Preview'}
                </button>
              </div>
            </div>
            {preview ? (
              <div style={styles.previewBox}>
                <Markdown content={content || '*Nothing to preview*'} />
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                style={styles.textarea}
                placeholder="Write your post content in Markdown..."
              />
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Make public (visible on public blog page)
          </label>
        </div>

        <div style={styles.modalFooter}>
          <button onClick={() => handleSave('draft')} disabled={saving || !title.trim() || !content.trim()} style={styles.draftBtn}>
            Save as Draft
          </button>
          <button onClick={() => handleSave('published')} disabled={saving || !title.trim() || !content.trim()} style={styles.publishBtn}>
            {saving ? 'Saving...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'var(--bg-primary)', borderRadius: 12, width: '90vw', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 },
  modalBody: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' },
  input: { padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' },
  textarea: { padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', minHeight: 240, resize: 'vertical', fontFamily: 'Consolas, Monaco, "Andale Mono", monospace', lineHeight: 1.5 },
  previewBox: { padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', minHeight: 240, overflowY: 'auto', fontSize: '0.95rem', lineHeight: 1.7 },
  toolBtn: { display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' },
  draftBtn: { padding: '8px 18px', background: 'var(--bg-tertiary)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  publishBtn: { padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  error: { margin: '0 20px', padding: '8px 12px', background: 'rgba(237,66,69,0.15)', color: 'var(--danger)', borderRadius: 'var(--radius)', fontSize: '0.85rem' },
};
