import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BlockRenderer } from '../../components/newsletter/BlockRenderer.js';
import type { Newsletter } from '@crabac/shared';

export function PublicPersonalNewsletterDetail() {
  const { username, newsletterId } = useParams();
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!username || !newsletterId) return;
    setLoading(true);
    fetch(`/api/newsletter-public/user/${username}/${newsletterId}`)
      .then((r) => r.json())
      .then((data) => {
        setNewsletter(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Newsletter not found');
        setLoading(false);
      });
  }, [username, newsletterId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>;
  if (error || !newsletter) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error || 'Not found'}</div>;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', height: '100vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
      <Link to={`/newsletter/u/${username}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#5865f2', textDecoration: 'none', fontSize: '0.85rem', marginBottom: 20 }}>
        <ArrowLeft size={16} /> Back to newsletters
      </Link>

      <article style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
        {newsletter.headerImageUrl && <img src={newsletter.headerImageUrl} alt="" style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />}
        <div style={{ padding: '32px 36px' }}>
          <h1 style={{ margin: '0 0 12px', fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.3 }}>{newsletter.subject}</h1>
          <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: 20 }}>
            <span style={{ fontWeight: 600 }}>{newsletter.author?.displayName}</span>
            <span> &middot; </span>
            <span>{newsletter.publishedAt ? new Date(newsletter.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</span>
          </div>
          {newsletter.summary && (
            <p style={{ margin: '0 0 24px', fontSize: '1.05rem', color: '#555', lineHeight: 1.6, fontStyle: 'italic', borderLeft: '3px solid #eee', paddingLeft: 16 }}>
              {newsletter.summary}
            </p>
          )}
          <BlockRenderer blocks={newsletter.blocks} />
        </div>
      </article>
    </div>
  );
}
