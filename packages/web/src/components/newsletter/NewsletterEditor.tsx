import { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import type { Newsletter, NewsletterBlock } from '@crabac/shared';
import { useNewsletterStore } from '../../stores/newsletter.js';
import { NewsletterBlockEditor } from './NewsletterBlockEditor.js';

interface Props {
  spaceId?: string | null;
  newsletter?: Newsletter | null;
  onClose: () => void;
}

export function NewsletterEditor({ spaceId, newsletter, onClose }: Props) {
  const { createNewsletter, updateNewsletter, uploadImage, createPersonalNewsletter, updatePersonalNewsletter, uploadPersonalImage } = useNewsletterStore();
  const [subject, setSubject] = useState(newsletter?.subject || '');
  const [summary, setSummary] = useState(newsletter?.summary || '');
  const [headerImageUrl, setHeaderImageUrl] = useState(newsletter?.headerImageUrl || '');
  const [blocks, setBlocks] = useState<NewsletterBlock[]>(newsletter?.blocks || [{ type: 'text', content: '' }]);
  const [isPublic, setIsPublic] = useState(newsletter?.isPublic ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const headerInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async (status: 'draft' | 'published') => {
    if (!subject.trim()) { setError('Subject is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { subject, summary: summary || null, headerImageUrl: headerImageUrl || null, blocks, status, isPublic };
      if (spaceId) {
        if (newsletter) {
          await updateNewsletter(spaceId, newsletter.id, payload);
        } else {
          await createNewsletter(spaceId, payload);
        }
      } else {
        if (newsletter) {
          await updatePersonalNewsletter(newsletter.id, payload);
        } else {
          await createPersonalNewsletter(payload);
        }
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleHeaderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = spaceId ? await uploadImage(spaceId, file) : await uploadPersonalImage(file);
      setHeaderImageUrl(url);
    } catch { /* ignore */ }
  };

  const handleBlockUpload = async (file: File) => {
    return spaceId ? uploadImage(spaceId, file) : uploadPersonalImage(file);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{newsletter ? 'Edit Newsletter' : 'New Newsletter'}</h2>
          <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
        </div>

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          {/* Header Image */}
          <div style={{ marginBottom: 16 }}>
            {headerImageUrl ? (
              <div style={{ position: 'relative' }}>
                <img src={headerImageUrl} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8 }} />
                <button onClick={() => setHeaderImageUrl('')} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button onClick={() => headerInputRef.current?.click()} style={{ width: '100%', padding: '16px', background: 'var(--bg-secondary)', border: '2px dashed var(--border)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Upload size={16} /> Header Image (optional)
              </button>
            )}
            <input ref={headerInputRef} type="file" accept="image/*" onChange={handleHeaderUpload} style={{ display: 'none' }} />
          </div>

          {/* Subject */}
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Newsletter subject"
            style={{ ...styles.input, fontSize: '1.2rem', fontWeight: 600, marginBottom: 8 }}
          />

          {/* Summary */}
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Brief summary (optional)"
            style={{ ...styles.input, marginBottom: 16 }}
          />

          {/* Blocks */}
          <NewsletterBlockEditor blocks={blocks} onChange={setBlocks} onUploadImage={handleBlockUpload} />

          {/* Options */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              Public
            </label>
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={() => handleSave('draft')} disabled={saving} style={styles.draftBtn}>
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button onClick={() => handleSave('published')} disabled={saving} style={styles.publishBtn}>
            {saving ? 'Publishing...' : 'Publish & Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'var(--bg-primary)', borderRadius: 12, width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' },
  body: { flex: 1, overflow: 'auto', padding: '20px' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' },
  input: { width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.95rem', boxSizing: 'border-box' as const },
  error: { background: 'rgba(237,66,69,0.15)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: '0.85rem', marginBottom: 12 },
  draftBtn: { padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem' },
  publishBtn: { padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
};
