import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Newsletter } from '@crabac/shared';
import { NewsletterSubscribeForm } from '../../components/newsletter/NewsletterSubscribeForm.js';

interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export function PublicPersonalNewsletterHome() {
  const { username } = useParams();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    fetch(`/api/newsletter-public/user/${username}`)
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user);
        setNewsletters(data.newsletters || []);
        setHasMore((data.newsletters || []).length >= 20);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load');
        setLoading(false);
      });
  }, [username]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error}</div>;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          {user.avatarUrl && <img src={user.avatarUrl} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />}
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{user.displayName}</h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#888' }}>@{user.username} &middot; Newsletter</p>
          </div>
        </div>
      )}

      {user && (
        <div style={{ marginBottom: 32, padding: '20px 24px', background: '#f8f9fa', borderRadius: 8, border: '1px solid #eee' }}>
          <NewsletterSubscribeForm sourceType="user" sourceId={user.id} />
        </div>
      )}

      {newsletters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>No newsletters published yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {newsletters.map((nl) => (
            <article key={nl.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
              {nl.headerImageUrl && <img src={nl.headerImageUrl} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />}
              <div style={{ padding: '24px 28px' }}>
                <Link to={`/newsletter/u/${username}/${nl.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.3 }}>{nl.subject}</h2>
                </Link>
                <div style={{ fontSize: '0.85rem', color: '#888', marginTop: 8 }}>
                  {nl.publishedAt ? new Date(nl.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                </div>
                {nl.summary && <p style={{ margin: '12px 0 0', fontSize: '1rem', color: '#555', lineHeight: 1.6 }}>{nl.summary}</p>}
                <Link to={`/newsletter/u/${username}/${nl.id}`} style={{ display: 'inline-block', marginTop: 12, fontSize: '0.9rem', color: '#5865f2', textDecoration: 'none' }}>
                  Read more →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
