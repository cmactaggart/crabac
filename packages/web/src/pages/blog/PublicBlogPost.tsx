import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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

export function PublicBlogPost() {
  const { spaceSlug, postId } = useParams();
  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!spaceSlug || !postId) return;
    setLoading(true);
    boardApi<{ space: SpaceInfo; post: BlogPost }>(`/blog/${spaceSlug}/${postId}`)
      .then((data) => {
        setSpace(data.space);
        setPost(data.post);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Post not found');
        setLoading(false);
      });
  }, [spaceSlug, postId]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Loading...</div>;
  }

  if (error || !post) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error || 'Post not found'}</div>;
  }

  return (
    <div>
      <Link to={`/blog/${spaceSlug}`} style={styles.backLink}>
        <ArrowLeft size={16} /> Back to blog
      </Link>

      <article style={styles.article}>
        <h1 style={styles.title}>{post.title}</h1>

        <div style={styles.meta}>
          <span style={{ fontWeight: 600 }}>{post.author?.displayName}</span>
          <span style={{ color: '#bbb' }}>&middot;</span>
          <span>
            {post.publishedAt
              ? new Date(post.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
              : ''}
          </span>
        </div>

        {post.summary && (
          <p style={styles.summary}>{post.summary}</p>
        )}

        <div style={styles.body}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {post.content}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backLink: { display: 'inline-flex', alignItems: 'center', gap: 4, color: '#5865f2', textDecoration: 'none', fontSize: '0.85rem', marginBottom: 20 },
  article: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '32px 36px' },
  title: { margin: '0 0 12px', fontSize: '1.8rem', fontWeight: 700, color: '#111', lineHeight: 1.3 },
  meta: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#999', marginBottom: 20 },
  summary: { margin: '0 0 24px', fontSize: '1.05rem', color: '#666', lineHeight: 1.6, fontStyle: 'italic', borderLeft: '3px solid #e5e7eb', paddingLeft: 16 },
  body: { fontSize: '1rem', lineHeight: 1.8, color: '#333' },
};
