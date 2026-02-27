import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { boardApi } from '../../lib/boardApi.js';
import { usePublicTheme } from '../../contexts/PublicThemeContext.js';
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
  const theme = usePublicTheme();
  const c = theme.colors;
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
    return <div style={{ textAlign: 'center', padding: 40, color: c.mutedText }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error}</div>;
  }

  return (
    <div>
      {space && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          {space.iconUrl && <img src={space.iconUrl} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} />}
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: c.headingColor }}>{space.name}</h1>
            {space.description && <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: c.secondaryText }}>{space.description}</p>}
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: c.mutedText }}>No blog posts yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {posts.map((post) => (
            <article key={post.id} style={{ background: c.contentBg, border: `1px solid ${c.contentBorder}`, borderRadius: c.contentRadius, padding: '32px 36px' }}>
              <Link to={`/blog/${spaceSlug}/${post.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: c.headingColor, lineHeight: 1.3 }}>{post.title}</h2>
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: c.mutedText, marginTop: 8 }}>
                <span style={{ fontWeight: 600 }}>{post.author?.displayName}</span>
                <span style={{ color: c.mutedText }}>&middot;</span>
                <span>
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'Draft'}
                </span>
              </div>
              {post.summary && (
                <p style={{ margin: '16px 0 0', fontSize: '1.05rem', color: c.secondaryText, lineHeight: 1.6, fontStyle: 'italic', borderLeft: `3px solid ${c.contentBorder}`, paddingLeft: 16 }}>
                  {post.summary}
                </p>
              )}
              <div style={{ marginTop: 20, fontSize: '1rem', lineHeight: 1.8, color: c.pageText }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {post.content}
                </ReactMarkdown>
              </div>
            </article>
          ))}
          {hasMore && (
            <button onClick={loadMore} style={{ background: 'none', border: 'none', color: c.linkColor, cursor: 'pointer', fontSize: '0.85rem', padding: 12, textAlign: 'center' }}>
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
