import type { LinkEmbed } from '@crabac/shared';

interface Props {
  embed: LinkEmbed;
}

export function UrlLinkEmbed({ embed }: Props) {
  const hostname = (() => {
    try {
      return new URL(embed.url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  })();

  return (
    <a href={embed.url} target="_blank" rel="noopener noreferrer" style={styles.embed}>
      <div style={styles.accentBar} />
      <div style={styles.body}>
        {(embed.siteName || hostname) && (
          <div style={styles.siteRow}>
            {embed.faviconUrl && (
              <img
                src={embed.faviconUrl}
                alt=""
                style={styles.favicon}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <span style={styles.siteName}>{embed.siteName || hostname}</span>
          </div>
        )}
        <div style={styles.contentRow}>
          <div style={styles.textCol}>
            {embed.title && <div style={styles.title}>{embed.title}</div>}
            {embed.description && <div style={styles.description}>{embed.description}</div>}
          </div>
          {embed.imageUrl && (
            <img
              src={embed.imageUrl}
              alt=""
              style={styles.thumbnail}
              referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>
      </div>
    </a>
  );
}

const styles: Record<string, React.CSSProperties> = {
  embed: {
    display: 'flex',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    marginTop: 6,
    maxWidth: 'min(520px, 100%)',
    textDecoration: 'none',
    color: 'inherit',
  },
  accentBar: {
    width: 4,
    background: 'var(--accent)',
    flexShrink: 0,
  },
  body: {
    padding: '10px 12px',
    flex: 1,
    minWidth: 0,
  },
  siteRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  favicon: {
    width: 16,
    height: 16,
    borderRadius: 2,
    flexShrink: 0,
  },
  siteName: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  contentRow: {
    display: 'flex',
    gap: 12,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: 'var(--accent)',
    lineHeight: 1.3,
    marginBottom: 2,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  description: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
  },
  thumbnail: {
    width: 80,
    height: 80,
    objectFit: 'cover',
    borderRadius: 'var(--radius)',
    flexShrink: 0,
  },
};
