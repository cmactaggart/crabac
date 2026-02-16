import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2, Eye, EyeOff, Globe } from 'lucide-react';
import type { BlogPost } from '@crabac/shared';
import { Markdown } from '../common/Markdown.js';
import { Avatar } from '../common/Avatar.js';
import { useBlogStore } from '../../stores/blog.js';

interface Props {
  post: BlogPost;
  spaceId: string;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export function BlogPostDetail({ post, spaceId, canManage, onClose, onEdit }: Props) {
  const { deletePost, updatePost } = useBlogStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deletePost(spaceId, post.id);
      onClose();
    } catch {
      setBusy(false);
    }
  };

  const handleToggleStatus = async () => {
    setBusy(true);
    try {
      await updatePost(spaceId, post.id, {
        status: post.status === 'published' ? 'draft' : 'published',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={onClose} style={styles.backBtn}>
          <ArrowLeft size={18} /> Back
        </button>
        {canManage && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleToggleStatus} disabled={busy} style={styles.actionBtn} title={post.status === 'published' ? 'Revert to Draft' : 'Publish'}>
              {post.status === 'published' ? <EyeOff size={16} /> : <Eye size={16} />}
              {post.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
            <button onClick={onEdit} style={styles.actionBtn}>
              <Pencil size={16} /> Edit
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} style={{ ...styles.actionBtn, color: 'var(--danger)' }}>
                <Trash2 size={16} /> Delete
              </button>
            ) : (
              <button onClick={handleDelete} disabled={busy} style={{ ...styles.actionBtn, background: 'var(--danger)', color: '#fff' }}>
                Confirm Delete
              </button>
            )}
          </div>
        )}
      </div>

      <div style={styles.content}>
        <h1 style={styles.title}>{post.title}</h1>

        <div style={styles.meta}>
          <Avatar src={post.author?.avatarUrl || null} name={post.author?.displayName || '?'} size={24} />
          <span style={{ fontWeight: 600 }}>{post.author?.displayName}</span>
          <span style={{ color: 'var(--text-muted)' }}>&middot;</span>
          <span style={{ color: 'var(--text-muted)' }}>
            {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Draft'}
          </span>
          {post.status === 'draft' && <span style={styles.draftBadge}>Draft</span>}
          {post.isPublic && <span style={{ ...styles.draftBadge, background: 'rgba(88,101,242,0.15)', color: 'var(--accent)' }}><Globe size={10} /> Public</span>}
        </div>

        {post.summary && (
          <p style={styles.summary}>{post.summary}</p>
        )}

        <div style={styles.body}>
          <Markdown content={post.content} />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  backBtn: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', padding: '4px 8px', borderRadius: 'var(--radius)' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--bg-tertiary)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 },
  content: { flex: 1, overflowY: 'auto', padding: '24px 24px 48px', maxWidth: 720, width: '100%', margin: '0 auto' },
  title: { margin: '0 0 12px', fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)' },
  meta: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 },
  summary: { margin: '0 0 20px', fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: 'italic' },
  body: { fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text-primary)' },
  draftBadge: { padding: '1px 6px', background: 'rgba(250,176,5,0.15)', color: '#fab005', borderRadius: 4, fontWeight: 600, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 3 },
};
