import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { boardApi } from '../../lib/boardApi.js';

interface BoardChannel {
  id: string;
  name: string;
  topic: string | null;
}

interface SpaceInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
}

export function BoardHome() {
  const { spaceSlug } = useParams();
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
        setChannels(data.channels);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load board');
        setLoading(false);
      });
  }, [spaceSlug]);

  if (loading) return <div style={styles.loading}>Loading...</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  return (
    <div>
      <div style={styles.banner}>
        <h1 style={styles.spaceName}>{space?.name}</h1>
        {space?.description && <p style={styles.description}>{space.description}</p>}
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Forum</th>
            <th style={{ ...styles.th, width: 200 }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((ch) => (
            <tr key={ch.id}>
              <td style={styles.td}>
                <Link to={`/boards/${spaceSlug}/${ch.name}`} style={styles.forumLink}>
                  {ch.name}
                </Link>
              </td>
              <td style={{ ...styles.td, color: '#666', fontSize: '0.85rem' }}>
                {ch.topic || '-'}
              </td>
            </tr>
          ))}
          {channels.length === 0 && (
            <tr>
              <td colSpan={2} style={{ ...styles.td, textAlign: 'center', color: '#999' }}>
                No public forums available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: { textAlign: 'center', padding: 40, color: '#999' },
  error: { textAlign: 'center', padding: 40, color: '#c53030' },
  banner: {
    marginBottom: 20,
    padding: '16px 20px',
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: 4,
  },
  spaceName: {
    margin: 0,
    fontSize: '1.4rem',
    color: '#2d3748',
  },
  description: {
    margin: '8px 0 0',
    color: '#666',
    fontSize: '0.9rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: 4,
    overflow: 'hidden',
  },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    background: '#4a5568',
    color: '#fff',
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  td: {
    padding: '10px 14px',
    borderBottom: '1px solid #e2e8f0',
  },
  forumLink: {
    color: '#2b6cb0',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '0.95rem',
  },
};
