import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { boardApi } from '../../lib/boardApi.js';
import type { BlogPost } from '@crabac/shared';

interface SpaceInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
}

export function PublicBlogHome() {
  const { spaceSlug } = useParams();
  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!spaceSlug) return;
    setLoading(true);
    boardApi<{ space: SpaceInfo; posts: BlogPost[] }>(`/blog/${spaceSlug}`)
      .then((data) => {
        setSpace(data.space);
        setPosts(data.posts);
        setHasMore(data.posts.length >= 20);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load blog');
        setLoading(false);
      });
  }, [spaceSlug]);

  const loadMore = async () => {
    if (!spaceSlug || loadingMore || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const lastId = posts[posts.length - 1].id;
      const data = await boardApi<{ space: SpaceInfo; posts: BlogPost[] }>(`/blog/${spaceSlug}?before=${lastId}`);
      setPosts((prev) => [...prev, ...data.posts]);
      setHasMore(data.posts.length >= 20);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error}</div>;
  }

  return (
    <div>
      {space && (
        <div style={styles.spaceHeader}>
          {space.iconUrl && <img src={space.iconUrl} alt="" style={styles.spaceIcon} />}
          <div>
            <h1 style={styles.spaceName}>{space.name}</h1>
            {space.description && <p style={styles.spaceDesc}>{space.description}</p>}
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>No blog posts yet</div>
      ) : (
        <div style={styles.postList}>
          {posts.map((post) => (
            <article key={post.id} style={styles.postCard}>
              <Link to={`/blog/${spaceSlug}/${post.id}`} style={styles.titleLink}>
                <h2 style={styles.postTitle}>{post.title}</h2>
              </Link>
              <div style={styles.postMeta}>
                <span style={{ fontWeight: 600 }}>{post.author?.displayName}</span>
                <span style={{ color: '#bbb' }}>&middot;</span>
                <span>
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'Draft'}
                </span>
              </div>
              {post.summary && (
                <p style={styles.postSummary}>{post.summary}</p>
              )}
              <div style={styles.postBody}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {post.content}
                </ReactMarkdown>
              </div>
            </article>
          ))}
          {hasMore && (
            <button onClick={loadMore} style={styles.loadMore}>
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  spaceHeader: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 },
  spaceIcon: { width: 48, height: 48, borderRadius: 12, objectFit: 'cover' },
  spaceName: { margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111' },
  spaceDesc: { margin: '4px 0 0', fontSize: '0.9rem', color: '#666' },
  postList: { display: 'flex', flexDirection: 'column', gap: 32 },
  postCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '32px 36px' },
  titleLink: { textDecoration: 'none', color: 'inherit' },
  postTitle: { margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111', lineHeight: 1.3 },
  postMeta: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#999', marginTop: 8 },
  postSummary: { margin: '16px 0 0', fontSize: '1.05rem', color: '#666', lineHeight: 1.6, fontStyle: 'italic', borderLeft: '3px solid #e5e7eb', paddingLeft: 16 },
  postBody: { marginTop: 20, fontSize: '1rem', lineHeight: 1.8, color: '#333' },
  loadMore: { background: 'none', border: 'none', color: '#5865f2', cursor: 'pointer', fontSize: '0.85rem', padding: 12, textAlign: 'center' },
};
