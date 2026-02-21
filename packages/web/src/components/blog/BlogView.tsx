import { useEffect, useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import type { BlogPost } from '@crabac/shared';
import { useBlogStore } from '../../stores/blog.js';
import { useAuthStore } from '../../stores/auth.js';
import { useHasSpacePermission } from '../settings/SpaceSettingsModal.js';
import { Permissions } from '@crabac/shared';
import { BlogPostDetail } from './BlogPostDetail.js';
import { BlogPostEditor } from './BlogPostEditor.js';

interface Props {
  spaceId: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function BlogView({ spaceId, showBackButton, onBack }: Props) {
  const { posts, loading, hasMore, fetchPosts, loadMore, selectedPost, setSelectedPost } = useBlogStore();
  const user = useAuthStore((s) => s.user);
  const canManage = useHasSpacePermission(spaceId, Permissions.MANAGE_BLOG);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  useEffect(() => {
    fetchPosts(spaceId);
    return () => useBlogStore.getState().clear();
  }, [spaceId, fetchPosts]);

  if (selectedPost) {
    return (
      <BlogPostDetail
        post={selectedPost}
        spaceId={spaceId}
        canManage={canManage || selectedPost.authorId === user?.id}
        onClose={() => setSelectedPost(null)}
        onEdit={() => { setEditingPost(selectedPost); setShowEditor(true); setSelectedPost(null); }}
      />
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {showBackButton && onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 8px', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>Back</button>
        )}
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Blog</h2>
        {canManage && (
          <button onClick={() => { setEditingPost(null); setShowEditor(true); }} style={styles.newBtn}>
            <Plus size={16} /> New Post
          </button>
        )}
      </div>

      <div style={styles.list}>
        {loading && posts.length === 0 ? (
          <div style={styles.empty}>Loading...</div>
        ) : posts.length === 0 ? (
          <div style={styles.empty}>No blog posts yet</div>
        ) : (
          <>
            {posts.map((post) => (
              <button
                key={post.id}
                onClick={() => setSelectedPost(post)}
                style={styles.postCard}
              >
                <div style={styles.postTitle}>{post.title}</div>
                {post.summary && <div style={styles.postSummary}>{post.summary}</div>}
                <div style={styles.postMeta}>
                  <span>{post.author?.displayName}</span>
                  <span style={{ color: 'var(--text-muted)' }}>&middot;</span>
                  <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Draft'}</span>
                  {post.status === 'draft' && <span style={styles.draftBadge}>Draft</span>}
                  {post.isPublic && <span style={{ ...styles.draftBadge, background: 'rgba(88,101,242,0.15)', color: 'var(--accent)' }}>Public</span>}
                </div>
              </button>
            ))}
            {hasMore && (
              <button onClick={() => loadMore(spaceId)} style={styles.loadMore}>
                {loading ? 'Loading...' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>

      {showEditor && (
        <BlogPostEditor
          spaceId={spaceId}
          editPost={editingPost}
          onClose={() => { setShowEditor(false); setEditingPost(null); }}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' },
  newBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  list: { flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  empty: { textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: '0.9rem' },
  postCard: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', cursor: 'pointer', textAlign: 'left', width: '100%', display: 'flex', flexDirection: 'column', gap: 4, transition: 'border-color 0.15s' },
  postTitle: { fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' },
  postSummary: { fontSize: '0.85rem', color: 'var(--text-secondary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  postMeta: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)' },
  draftBadge: { padding: '1px 6px', background: 'rgba(250,176,5,0.15)', color: '#fab005', borderRadius: 4, fontWeight: 600, fontSize: '0.7rem' },
  loadMore: { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.85rem', padding: 8, textAlign: 'center' },
};
