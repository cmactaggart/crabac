import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Globe, Lock } from 'lucide-react';
import { useAuthStore } from '../stores/auth.js';
import { api } from '../lib/api.js';
import { LetterIcon } from '../components/icons/LetterIcon.js';

interface SpaceInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  isPublic: boolean;
}

export function PublicSpaceLanding() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    api<SpaceInfo>(`/spaces/by-slug/${slug}`)
      .then(setSpace)
      .catch((err) => setError(err.message || 'Space not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !space) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={{ marginTop: 0 }}>Space Not Found</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{error || 'This space does not exist.'}</p>
          <Link to="/" style={styles.link}>Go home</Link>
        </div>
      </div>
    );
  }

  if (!space.isPublic) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.iconWrap}>
            <Lock size={32} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h2 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>{space.name}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            This space is invite only.
          </p>
          <Link to="/" style={styles.link}>Go home</Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.iconWrap}>
            {space.iconUrl ? (
              <img src={space.iconUrl} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <LetterIcon letter={space.name.charAt(0)} size={64} />
            )}
          </div>
          <h2 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>{space.name}</h2>
          {space.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{space.description}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <Globe size={14} /> Public Space
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link to={`/login?redirect=/space/slug/${slug}`} style={styles.primaryBtn}>
              Log in to enter
            </Link>
            <Link to={`/register?redirect=/space/slug/${slug}`} style={styles.secondaryBtn}>
              Create an account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Logged in — redirect to space
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          {space.iconUrl ? (
            <img src={space.iconUrl} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={styles.placeholderIcon}>{space.name.charAt(0).toUpperCase()}</div>
          )}
        </div>
        <h2 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>{space.name}</h2>
        {space.description && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{space.description}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <Globe size={14} /> Public Space
        </div>
        <button
          onClick={() => navigate(`/space/${space.id}`)}
          style={styles.primaryBtn}
        >
          Enter Space
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '2rem',
  },
  card: {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: '2rem',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  iconWrap: {
    display: 'flex',
    justifyContent: 'center',
  },
  placeholderIcon: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '1.8rem',
    color: 'white',
  },
  primaryBtn: {
    padding: '0.7rem 1.5rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
    textDecoration: 'none',
    textAlign: 'center',
    width: '100%',
  },
  secondaryBtn: {
    padding: '0.7rem 1.5rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
    textDecoration: 'none',
    textAlign: 'center',
    width: '100%',
  },
  link: {
    color: 'var(--accent)',
    fontSize: '0.9rem',
    marginTop: '0.5rem',
  },
};
