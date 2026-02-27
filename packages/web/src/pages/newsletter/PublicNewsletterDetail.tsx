import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usePublicTheme } from '../../contexts/PublicThemeContext.js';
import { BlockRenderer } from '../../components/newsletter/BlockRenderer.js';
import type { Newsletter } from '@crabac/shared';

export function PublicNewsletterDetail() {
  const { spaceSlug, newsletterId } = useParams();
  const theme = usePublicTheme();
  const c = theme.colors;
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!spaceSlug || !newsletterId) return;
    setLoading(true);
    fetch(`/api/newsletter-public/space/${spaceSlug}/${newsletterId}`)
      .then((r) => r.json())
      .then((data) => {
        setNewsletter(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Newsletter not found');
        setLoading(false);
      });
  }, [spaceSlug, newsletterId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: c.mutedText }}>Loading...</div>;
  if (error || !newsletter) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error || 'Not found'}</div>;

  return (
    <div>
      <Link to={`/newsletter/${spaceSlug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: c.linkColor, textDecoration: 'none', fontSize: '0.85rem', marginBottom: 20 }}>
        <ArrowLeft size={16} /> Back to newsletters
      </Link>

      <article style={{ background: c.contentBg, border: `1px solid ${c.contentBorder}`, borderRadius: c.contentRadius, overflow: 'hidden' }}>
        {newsletter.headerImageUrl && (
          <img src={newsletter.headerImageUrl} alt="" style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />
        )}
        <div style={{ padding: '32px 36px' }}>
          <h1 style={{ margin: '0 0 12px', fontSize: '1.8rem', fontWeight: 700, color: c.headingColor, lineHeight: 1.3 }}>{newsletter.subject}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: c.mutedText, marginBottom: 20 }}>
            <span style={{ fontWeight: 600 }}>{newsletter.author?.displayName}</span>
            <span>&middot;</span>
            <span>{newsletter.publishedAt ? new Date(newsletter.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</span>
          </div>

          {newsletter.summary && (
            <p style={{ margin: '0 0 24px', fontSize: '1.05rem', color: c.secondaryText, lineHeight: 1.6, fontStyle: 'italic', borderLeft: `3px solid ${c.contentBorder}`, paddingLeft: 16 }}>
              {newsletter.summary}
            </p>
          )}

          <BlockRenderer blocks={newsletter.blocks} />
        </div>
      </article>
    </div>
  );
}
