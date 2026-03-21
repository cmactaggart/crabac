import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Newspaper, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSpacesStore } from '../stores/spaces.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { SpaceSidebar } from '../components/layout/SpaceSidebar.js';
import { Avatar } from '../components/common/Avatar.js';
import { api } from '../lib/api.js';

interface RecentItem {
  id: string;
  itemType: 'blog' | 'newsletter';
  spaceId: string;
  authorId: string;
  title?: string;
  summary?: string | null;
  content?: string;
  subject?: string;
  headerImageUrl?: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  spaceName?: string | null;
  spaceSlug?: string | null;
  author?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getItemTitle(item: RecentItem): string {
  return item.itemType === 'blog' ? (item.title || 'Untitled') : (item.subject || 'Untitled');
}

function getItemSummary(item: RecentItem): string | null {
  if (item.summary) return item.summary;
  if (item.itemType === 'blog' && item.content) {
    return item.content.slice(0, 200).replace(/[#*_\[\]]/g, '').trim() + (item.content.length > 200 ? '...' : '');
  }
  return null;
}

function getItemUrl(item: RecentItem): string {
  if (item.itemType === 'blog') return `/blog/${item.spaceSlug}/${item.id}`;
  return `/newsletter/${item.spaceSlug}/${item.id}`;
}

function RecentPostsView() {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api<RecentItem[]>('/users/me/posts/recent?limit=30')
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ width: '100%', maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={styles.backBtn}>
          <ArrowLeft size={18} />
        </button>
        <BookOpen size={20} style={{ color: 'var(--accent)' }} />
        <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Recent Posts</h1>
      </div>

      {loading && <div style={styles.empty}>Loading...</div>}
      {!loading && items.length === 0 && <div style={styles.empty}>No recent blog or newsletter posts</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => (
          <button
            key={`${item.itemType}-${item.id}`}
            onClick={() => navigate(getItemUrl(item))}
            style={styles.card}
          >
            {item.itemType === 'newsletter' && item.headerImageUrl && (
              <div style={styles.cardImage}>
                <img src={item.headerImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div style={styles.cardBody}>
              <div style={styles.meta}>
                <span style={styles.typeBadge}>
                  {item.itemType === 'blog' ? <><BookOpen size={11} /> Blog</> : <><Newspaper size={11} /> Newsletter</>}
                </span>
                {item.spaceName && <span style={styles.spaceBadge}>{item.spaceName}</span>}
                <span style={styles.date}>{formatDate(item.publishedAt || item.createdAt)}</span>
              </div>
              <div style={styles.title}>{getItemTitle(item)}</div>
              {getItemSummary(item) && <div style={styles.summary}>{getItemSummary(item)}</div>}
              {item.author && (
                <div style={styles.authorRow}>
                  <Avatar src={item.author.avatarUrl} name={item.author.displayName} size={18} baseColor={null} accentColor={null} />
                  <span style={styles.authorName}>{item.author.displayName}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', color: 'var(--text-muted)', flexShrink: 0 }}>
              <ChevronRight size={16} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function RecentPostsPage() {
  const isMobile = useIsMobile();
  const { spaces, fetchSpaces } = useSpacesStore();
  useEffect(() => { fetchSpaces(); }, [fetchSpaces]);

  if (isMobile) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, overflowY: 'auto', padding: '1rem', background: 'linear-gradient(to bottom, var(--bg-primary), color-mix(in srgb, var(--bg-primary), black 18%))' }}>
        <RecentPostsView />
      </div>
    );
  }

  return (
    <div style={layoutStyles.layout}>
      <div style={layoutStyles.sidebarWrap}>
        <SpaceSidebar spaces={spaces} activeSpaceId={null} />
      </div>
      <div style={layoutStyles.main}>
        <RecentPostsView />
      </div>
    </div>
  );
}

const layoutStyles: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', height: '100vh', overflow: 'hidden' },
  sidebarWrap: { overflow: 'hidden', flexShrink: 0, transition: 'width 0.2s ease', height: '100%' },
  main: { flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', justifyContent: 'center' },
};

const styles: Record<string, React.CSSProperties> = {
  backBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 'var(--radius)',
    border: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
  },
  empty: {
    textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem',
  },
  card: {
    display: 'flex', alignItems: 'stretch',
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', overflow: 'hidden',
    cursor: 'pointer', textAlign: 'left', color: 'inherit', padding: 0,
  },
  cardImage: { width: 100, minHeight: 80, flexShrink: 0, overflow: 'hidden' },
  cardBody: { flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  meta: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.7rem', color: 'var(--text-muted)' },
  typeBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em',
  },
  spaceBadge: {
    background: 'var(--bg-tertiary)', padding: '0px 5px', borderRadius: 6,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120,
  },
  date: { marginLeft: 'auto', flexShrink: 0 },
  title: { fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.3 },
  summary: {
    fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4,
    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  },
  authorRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 },
  authorName: { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 },
};
