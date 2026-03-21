import { useEffect, useState } from 'react';
import { BookOpen, Newspaper, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../common/Avatar.js';
import { api } from '../../lib/api.js';

interface RecentItem {
  id: string;
  itemType: 'blog' | 'newsletter';
  spaceId: string;
  authorId: string;
  // Blog fields
  title?: string;
  summary?: string | null;
  content?: string;
  // Newsletter fields
  subject?: string;
  headerImageUrl?: string | null;
  // Common
  status: string;
  publishedAt: string | null;
  createdAt: string;
  spaceName?: string | null;
  spaceSlug?: string | null;
  spaceIconUrl?: string | null;
  author?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface Props {
  onShowMore: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getItemTitle(item: RecentItem): string {
  return item.itemType === 'blog' ? (item.title || 'Untitled') : (item.subject || 'Untitled');
}

function getItemSummary(item: RecentItem): string | null {
  if (item.summary) return item.summary;
  if (item.itemType === 'blog' && item.content) {
    return item.content.slice(0, 120).replace(/[#*_\[\]]/g, '').trim() + (item.content.length > 120 ? '...' : '');
  }
  return null;
}

function getItemUrl(item: RecentItem): string {
  if (item.itemType === 'blog') {
    return `/blog/${item.spaceSlug}/${item.id}`;
  }
  return `/newsletter/${item.spaceSlug}/${item.id}`;
}

export function RecentPostsCard({ onShowMore }: Props) {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api<RecentItem[]>('/users/me/posts/recent?limit=5')
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <BookOpen size={16} />
          <span style={styles.headerText}>Recent Posts</span>
        </div>
        <div style={styles.empty}>Loading...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <BookOpen size={16} />
          <span style={styles.headerText}>Recent Posts</span>
        </div>
        <div style={styles.empty}>No recent blog or newsletter posts</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <BookOpen size={16} />
        <span style={styles.headerText}>Recent Posts</span>
        <span style={styles.count}>{items.length}</span>
      </div>

      <div style={styles.list}>
        {items.map((item) => (
          <button
            key={`${item.itemType}-${item.id}`}
            onClick={() => navigate(getItemUrl(item))}
            style={styles.card}
          >
            {/* Header image for newsletters */}
            {item.itemType === 'newsletter' && item.headerImageUrl && (
              <div style={styles.cardImage}>
                <img src={item.headerImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <div style={styles.cardBody}>
              <div style={styles.cardMeta}>
                <span style={styles.typeBadge}>
                  {item.itemType === 'blog' ? <><BookOpen size={10} /> Blog</> : <><Newspaper size={10} /> Newsletter</>}
                </span>
                {item.spaceName && (
                  <span style={styles.spaceBadge}>{item.spaceName}</span>
                )}
                <span style={styles.date}>{formatDate(item.publishedAt || item.createdAt)}</span>
              </div>

              <div style={styles.cardTitle}>{getItemTitle(item)}</div>

              {getItemSummary(item) && (
                <div style={styles.cardSummary}>{getItemSummary(item)}</div>
              )}

              {item.author && (
                <div style={styles.authorRow}>
                  <Avatar src={item.author.avatarUrl} name={item.author.displayName} size={16} baseColor={null} accentColor={null} />
                  <span style={styles.authorName}>{item.author.displayName}</span>
                </div>
              )}
            </div>

            <div style={styles.chevronWrap}>
              <ChevronRight size={14} />
            </div>
          </button>
        ))}
      </div>

      <button onClick={onShowMore} style={styles.showMore}>
        Show more
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#3a2222',
    padding: '0 1.5rem',
  },
  headerText: {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    flex: 1,
    color: '#3a2222',
  },
  count: {
    fontSize: '0.7rem',
    fontWeight: 600,
    background: 'rgba(0,0,0,0.08)',
    color: '#7a5a5a',
    padding: '1px 7px',
    borderRadius: 10,
  },
  empty: {
    textAlign: 'center',
    padding: '24px 1.5rem',
    color: '#7a5a5a',
    fontSize: '0.85rem',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '0 1rem',
  },
  card: {
    display: 'flex',
    alignItems: 'stretch',
    background: 'white',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#2e1a1a',
    padding: 0,
  },
  cardImage: {
    width: 80,
    minHeight: 70,
    flexShrink: 0,
    overflow: 'hidden',
  },
  cardBody: {
    flex: 1,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.65rem',
    color: '#7a5a5a',
  },
  typeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  spaceBadge: {
    background: 'rgba(0,0,0,0.06)',
    padding: '0px 5px',
    borderRadius: 6,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 100,
  },
  date: {
    marginLeft: 'auto',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#2e1a1a',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardSummary: {
    fontSize: '0.72rem',
    color: '#5a3a3a',
    lineHeight: 1.4,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  authorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  authorName: {
    fontSize: '0.68rem',
    color: '#7a5a5a',
    fontWeight: 600,
  },
  chevronWrap: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    color: '#bba09a',
    flexShrink: 0,
  },
  showMore: {
    background: 'none',
    border: 'none',
    color: '#8b4513',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 1.5rem',
    textAlign: 'center',
  },
};
