import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { boardApi } from '../../lib/boardApi.js';
import { usePublicTheme } from '../../contexts/PublicThemeContext.js';

interface BoardChannel {
  id: string;
  name: string;
  topic: string | null;
  type: string;
}

interface SpaceInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
}

export function PublicGalleryHome() {
  const { spaceSlug } = useParams();
  const navigate = useNavigate();
  const theme = usePublicTheme();
  const c = theme.colors;
  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [channels, setChannels] = useState<BoardChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!spaceSlug) return;
    setLoading(true);
    boardApi<{ space: SpaceInfo; channels: BoardChannel[] }>(`/${spaceSlug}`)
      .then((data) => {
        setSpace(data.space);
        const galleries = data.channels.filter((ch) => ch.type === 'media_gallery');
        // Auto-redirect when only one gallery exists
        if (galleries.length === 1) {
          navigate(`/gallery/${spaceSlug}/${galleries[0].name}`, { replace: true });
          return;
        }
        setChannels(galleries);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load galleries');
        setLoading(false);
      });
  }, [spaceSlug]);

  const styles: Record<string, React.CSSProperties> = {
    status: { textAlign: 'center', padding: 40, color: c.mutedText },
    error: { textAlign: 'center', padding: 40, color: '#c53030' },
    empty: { textAlign: 'center', padding: 40, color: c.mutedText, fontSize: '0.9rem' },
    banner: {
      marginBottom: 24,
    },
    spaceName: {
      margin: 0,
      fontSize: '1.5rem',
      color: c.headingColor,
      fontWeight: 700,
    },
    description: {
      margin: '6px 0 0',
      color: c.secondaryText,
      fontSize: '0.9rem',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 16,
    },
    card: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '28px 20px',
      background: c.contentBg,
      border: `1px solid ${c.contentBorder}`,
      borderRadius: 10,
      textDecoration: 'none',
      color: 'inherit',
      transition: 'box-shadow 0.15s, border-color 0.15s',
    },
    cardIcon: {
      marginBottom: 12,
      opacity: 0.6,
    },
    cardName: {
      margin: 0,
      fontSize: '1rem',
      fontWeight: 600,
      color: c.headingColor,
    },
    cardTopic: {
      margin: '4px 0 0',
      fontSize: '0.8rem',
      color: c.mutedText,
      textAlign: 'center',
    },
  };

  if (loading) return <div style={styles.status}>Loading...</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  return (
    <div>
      <div style={styles.banner}>
        <h1 style={styles.spaceName}>{space?.name}</h1>
        {space?.description && <p style={styles.description}>{space.description}</p>}
      </div>

      {channels.length === 0 ? (
        <div style={styles.empty}>No public galleries available</div>
      ) : (
        <div style={styles.grid}>
          {channels.map((ch) => (
            <Link
              key={ch.id}
              to={`/gallery/${spaceSlug}/${ch.name}`}
              style={styles.card}
            >
              <div style={styles.cardIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c.mutedText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <h3 style={styles.cardName}>{ch.name}</h3>
              {ch.topic && <p style={styles.cardTopic}>{ch.topic}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
