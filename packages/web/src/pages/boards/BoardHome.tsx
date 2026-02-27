import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { boardApi } from '../../lib/boardApi.js';
import { usePublicTheme } from '../../contexts/PublicThemeContext.js';

interface BoardChannel {
  id: string;
  name: string;
  topic: string | null;
  type?: string;
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
        setChannels(data.channels);
        // Auto-redirect when only one board channel exists
        const forumChannels = data.channels.filter((ch) => !ch.type || ch.type === 'forum');
        if (forumChannels.length === 1) {
          navigate(`/boards/${spaceSlug}/${forumChannels[0].name}`, { replace: true });
          return;
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load board');
        setLoading(false);
      });
  }, [spaceSlug]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: c.mutedText }}>Loading...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c53030' }}>{error}</div>;

  const isTable = theme.layout.forumChannelList === 'table';

  return (
    <div>
      <div style={{
        marginBottom: 20,
        padding: '16px 20px',
        background: c.contentBg,
        border: `1px solid ${c.contentBorder}`,
        borderRadius: c.contentRadius,
      }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', color: c.headingColor }}>{space?.name}</h1>
        {space?.description && <p style={{ margin: '8px 0 0', color: c.secondaryText, fontSize: '0.9rem' }}>{space.description}</p>}
      </div>

      {isTable ? (
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          background: c.contentBg,
          border: `1px solid ${c.contentBorder}`,
          borderRadius: c.contentRadius,
          overflow: 'hidden',
        }}>
          <thead>
            <tr>
              <th style={{
                textAlign: 'left',
                padding: '10px 14px',
                background: c.tableHeaderBg,
                color: c.tableHeaderColor,
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>Forum</th>
              <th style={{
                textAlign: 'left',
                padding: '10px 14px',
                background: c.tableHeaderBg,
                color: c.tableHeaderColor,
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                width: 200,
              }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => (
              <tr key={ch.id}>
                <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.contentBorder}` }}>
                  <Link to={`/boards/${spaceSlug}/${ch.name}`} style={{ color: c.linkColor, fontWeight: 600, textDecoration: 'none', fontSize: '0.95rem' }}>
                    {ch.name}
                  </Link>
                </td>
                <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.contentBorder}`, color: c.secondaryText, fontSize: '0.85rem' }}>
                  {ch.topic || '-'}
                </td>
              </tr>
            ))}
            {channels.length === 0 && (
              <tr>
                <td colSpan={2} style={{ padding: '10px 14px', borderBottom: `1px solid ${c.contentBorder}`, textAlign: 'center', color: c.mutedText }}>
                  No public forums available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        channels.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: c.mutedText, fontSize: '0.9rem' }}>
            No public forums available
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {channels.map((ch) => (
              <Link
                key={ch.id}
                to={`/boards/${spaceSlug}/${ch.name}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '20px 16px',
                  background: c.contentBg,
                  border: `1px solid ${c.contentBorder}`,
                  borderRadius: c.contentRadius,
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'box-shadow 0.15s',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: c.headingColor }}>{ch.name}</h3>
                {ch.topic && <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: c.mutedText }}>{ch.topic}</p>}
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}
