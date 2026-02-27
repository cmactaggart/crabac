import { ArrowLeft, Pencil, Trash2, Send } from 'lucide-react';
import type { Newsletter } from '@crabac/shared';
import { BlockRenderer } from './BlockRenderer.js';
import { useNewsletterStore } from '../../stores/newsletter.js';

interface Props {
  newsletter: Newsletter;
  spaceId?: string;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete?: () => Promise<void>;
}

export function NewsletterDetail({ newsletter, spaceId, canManage, onClose, onEdit, onDelete }: Props) {
  const { deleteNewsletter, updateNewsletter, deletePersonalNewsletter, updatePersonalNewsletter } = useNewsletterStore();

  const handleDelete = async () => {
    if (!confirm('Delete this newsletter?')) return;
    if (onDelete) {
      await onDelete();
    } else if (spaceId) {
      await deleteNewsletter(spaceId, newsletter.id);
    } else {
      await deletePersonalNewsletter(newsletter.id);
    }
    onClose();
  };

  const handlePublish = async () => {
    if (!confirm('Publish this newsletter and send to subscribers?')) return;
    if (spaceId) {
      await updateNewsletter(spaceId, newsletter.id, { status: 'published' });
    } else {
      await updatePersonalNewsletter(newsletter.id, { status: 'published' });
    }
    onClose();
  };

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <button onClick={onClose} style={styles.backBtn}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {canManage && newsletter.status === 'draft' && (
            <button onClick={handlePublish} style={styles.publishBtn}>
              <Send size={14} /> Publish
            </button>
          )}
          {canManage && (
            <>
              <button onClick={onEdit} style={styles.actionBtn}><Pencil size={14} /> Edit</button>
              <button onClick={handleDelete} style={{ ...styles.actionBtn, color: 'var(--danger)' }}><Trash2 size={14} /> Delete</button>
            </>
          )}
        </div>
      </div>

      <div style={styles.content}>
        {newsletter.headerImageUrl && (
          <img src={newsletter.headerImageUrl} alt="" style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 8, marginBottom: 20 }} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {newsletter.status === 'draft' && (
            <span style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Draft</span>
          )}
          {newsletter.isPublic && (
            <span style={{ background: 'rgba(88,101,242,0.15)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>Public</span>
          )}
        </div>

        <h1 style={{ margin: '0 0 12px', fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.3 }}>{newsletter.subject}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 24 }}>
          <span style={{ fontWeight: 600 }}>{newsletter.author?.displayName}</span>
          <span>&middot;</span>
          <span>{newsletter.publishedAt ? new Date(newsletter.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Draft'}</span>
        </div>

        {newsletter.summary && (
          <p style={{ margin: '0 0 24px', fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic', borderLeft: '3px solid var(--border)', paddingLeft: 16 }}>
            {newsletter.summary}
          </p>
        )}

        <BlockRenderer blocks={newsletter.blocks} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' },
  actionBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 10px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' },
  publishBtn: { background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', padding: '6px 12px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 600 },
  content: { flex: 1, overflow: 'auto', padding: '24px', maxWidth: 720, margin: '0 auto', width: '100%', boxSizing: 'border-box' },
};
