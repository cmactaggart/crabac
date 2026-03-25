import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Volume2, Users } from 'lucide-react';
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

export function PublicVoiceHome() {
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
        const voiceChannels = data.channels.filter((ch) => ch.type === 'voice');
        if (voiceChannels.length === 1) {
          navigate(`/${spaceSlug}/voice/${voiceChannels[0].name}`, { replace: true });
          return;
        }
        setChannels(voiceChannels);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load voice channels');
        setLoading(false);
      });
  }, [spaceSlug]);

  const styles: Record<string, React.CSSProperties> = {
    status: { textAlign: 'center', padding: 40, color: c.mutedText },
    error: { textAlign: 'center', padding: 40, color: '#c53030' },
    empty: { textAlign: 'center', padding: 40, color: c.mutedText, fontSize: '0.9rem' },
    banner: { marginBottom: 24 },
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
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 16,
    },
    card: {
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 20px',
      background: c.contentBg,
      borderRadius: 10,
      textDecoration: 'none',
      color: c.pageText,
      border: `1px solid ${c.headerBorder}`,
      transition: 'transform 0.15s, box-shadow 0.15s',
    },
    cardIcon: {
      width: 48,
      height: 48,
      borderRadius: 10,
      background: c.accent,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    channelName: {
      fontSize: '1.1rem',
      fontWeight: 700,
      color: c.headingColor,
      margin: '0 0 4px 0',
    },
    topic: {
      fontSize: '0.85rem',
      color: c.secondaryText,
      margin: 0,
    },
  };

  if (loading) return <div style={styles.status}>Loading...</div>;
  if (error) return <div style={styles.error}>{error}</div>;
  if (!space) return <div style={styles.error}>Space not found</div>;

  return (
    <div>
      <div style={styles.banner}>
        <h1 style={styles.spaceName}>{space.name}</h1>
        {space.description && <p style={styles.description}>{space.description}</p>}
      </div>
      {channels.length === 0 ? (
        <div style={styles.empty}>No public voice channels available.</div>
      ) : (
        <div style={styles.grid}>
          {channels.map((ch) => (
            <Link
              key={ch.id}
              to={`/${spaceSlug}/voice/${ch.name}`}
              style={styles.card}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = '';
                (e.currentTarget as HTMLElement).style.boxShadow = '';
              }}
            >
              <div style={styles.cardIcon}>
                <Volume2 size={24} color="#fff" />
              </div>
              <h3 style={styles.channelName}>{ch.name}</h3>
              {ch.topic && <p style={styles.topic}>{ch.topic}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
