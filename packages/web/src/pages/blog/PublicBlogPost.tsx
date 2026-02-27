import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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

export function PublicBlogPost() {
  const { spaceSlug, postId } = useParams();
  const theme = usePublicTheme();
  const c = theme.colors;
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
    return <div style={{ textAlign: 'center', padding: 40, color: c.mutedText }}>Loading...</div>;
  }

  if (error || !post) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error || 'Post not found'}</div>;
  }

  return (
    <div>
      <Link to={`/blog/${spaceSlug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: c.linkColor, textDecoration: 'none', fontSize: '0.85rem', marginBottom: 20 }}>
        <ArrowLeft size={16} /> Back to blog
      </Link>

      <article style={{ background: c.contentBg, border: `1px solid ${c.contentBorder}`, borderRadius: c.contentRadius, padding: '32px 36px' }}>
        <h1 style={{ margin: '0 0 12px', fontSize: '1.8rem', fontWeight: 700, color: c.headingColor, lineHeight: 1.3 }}>{post.title}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: c.mutedText, marginBottom: 20 }}>
          <span style={{ fontWeight: 600 }}>{post.author?.displayName}</span>
          <span style={{ color: c.mutedText }}>&middot;</span>
          <span>
            {post.publishedAt
              ? new Date(post.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
              : ''}
          </span>
        </div>

        {post.summary && (
          <p style={{ margin: '0 0 24px', fontSize: '1.05rem', color: c.secondaryText, lineHeight: 1.6, fontStyle: 'italic', borderLeft: `3px solid ${c.contentBorder}`, paddingLeft: 16 }}>
            {post.summary}
          </p>
        )}

        <div style={{ fontSize: '1rem', lineHeight: 1.8, color: c.pageText }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {post.content}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
