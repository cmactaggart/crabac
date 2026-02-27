import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePublicTheme } from '../../contexts/PublicThemeContext.js';
import type { Newsletter } from '@crabac/shared';
import { NewsletterSubscribeForm } from '../../components/newsletter/NewsletterSubscribeForm.js';

interface SpaceInfo {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
}

export function PublicNewsletterHome() {
  const { spaceSlug } = useParams();
  const theme = usePublicTheme();
  const c = theme.colors;
  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!spaceSlug) return;
    setLoading(true);
    fetch(`/api/newsletter-public/space/${spaceSlug}`)
      .then((r) => r.json())
      .then((data) => {
        setSpace(data.space);
        setNewsletters(data.newsletters || []);
        setHasMore((data.newsletters || []).length >= 20);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load newsletters');
        setLoading(false);
      });
  }, [spaceSlug]);

  const loadMore = async () => {
    if (!spaceSlug || loadingMore || newsletters.length === 0) return;
    setLoadingMore(true);
    try {
      const lastId = newsletters[newsletters.length - 1].id;
      const res = await fetch(`/api/newsletter-public/space/${spaceSlug}?before=${lastId}`);
      const data = await res.json();
      setNewsletters((prev) => [...prev, ...(data.newsletters || [])]);
      setHasMore((data.newsletters || []).length >= 20);
    } catch { /* ignore */ }
    finally { setLoadingMore(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: c.mutedText }}>Loading...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error}</div>;

  return (
    <div>
      {space && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          {space.iconUrl && <img src={space.iconUrl} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} />}
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: c.headingColor }}>{space.name}</h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: c.secondaryText }}>Newsletter</p>
          </div>
        </div>
      )}

      {space && (
        <div style={{ marginBottom: 32, padding: '20px 24px', background: c.contentBg, border: `1px solid ${c.contentBorder}`, borderRadius: c.contentRadius }}>
          <NewsletterSubscribeForm sourceType="space" sourceId={space.id} theme={c} />
        </div>
      )}

      {newsletters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: c.mutedText }}>No newsletters published yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {newsletters.map((nl) => (
            <article key={nl.id} style={{ background: c.contentBg, border: `1px solid ${c.contentBorder}`, borderRadius: c.contentRadius, overflow: 'hidden' }}>
              {nl.headerImageUrl && (
                <img src={nl.headerImageUrl} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
              )}
              <div style={{ padding: '24px 28px' }}>
                <Link to={`/newsletter/${spaceSlug}/${nl.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: c.headingColor, lineHeight: 1.3 }}>{nl.subject}</h2>
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: c.mutedText, marginTop: 8 }}>
                  <span style={{ fontWeight: 600 }}>{nl.author?.displayName}</span>
                  <span>&middot;</span>
                  <span>{nl.publishedAt ? new Date(nl.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</span>
                </div>
                {nl.summary && (
                  <p style={{ margin: '12px 0 0', fontSize: '1rem', color: c.secondaryText, lineHeight: 1.6 }}>{nl.summary}</p>
                )}
                <Link to={`/newsletter/${spaceSlug}/${nl.id}`} style={{ display: 'inline-block', marginTop: 12, fontSize: '0.9rem', color: c.linkColor, textDecoration: 'none' }}>
                  Read more →
                </Link>
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
