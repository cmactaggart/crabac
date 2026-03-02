import { useEffect, useState } from 'react';
import { Plus, BarChart3, Mail } from 'lucide-react';
import type { Newsletter } from '@crabac/shared';
import { Permissions } from '@crabac/shared';
import { useNewsletterStore } from '../../stores/newsletter.js';
import { useAuthStore } from '../../stores/auth.js';
import { useHasSpacePermission } from '../settings/SpaceSettingsModal.js';
import { NewsletterDetail } from './NewsletterDetail.js';
import { NewsletterEditor } from './NewsletterEditor.js';
import { NewsletterAnalytics } from './NewsletterAnalytics.js';
import { api } from '../../lib/api.js';

interface Props {
  spaceId: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function NewsletterView({ spaceId, showBackButton, onBack }: Props) {
  const { newsletters, loading, hasMore, fetchNewsletters, loadMore, selectedNewsletter, setSelectedNewsletter } = useNewsletterStore();
  const user = useAuthStore((s) => s.user);
  const canManage = useHasSpacePermission(spaceId, Permissions.MANAGE_NEWSLETTER);
  const [showEditor, setShowEditor] = useState(false);
  const [editingNewsletter, setEditingNewsletter] = useState<Newsletter | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [stats, setStats] = useState<{ drafts: number; published: number; subscribers: number } | null>(null);

  useEffect(() => {
    fetchNewsletters(spaceId);
    return () => useNewsletterStore.getState().clear();
  }, [spaceId, fetchNewsletters]);

  // Check subscription status + fetch stats
  useEffect(() => {
    api(`/newsletter-subscriptions/check?sourceType=space&sourceId=${spaceId}`)
      .then((sub: any) => setSubscribed(sub ? sub.isActive : false))
      .catch(() => {});
    if (canManage) {
      api(`/spaces/${spaceId}/newsletter-stats`)
        .then((data: any) => setStats(data))
        .catch(() => {});
    }
  }, [spaceId, canManage]);

  const toggleSubscription = async () => {
    try {
      if (subscribed) {
        const subs = await api<any[]>('/newsletter-subscriptions');
        const sub = subs.find((s) => s.sourceType === 'space' && s.sourceId === spaceId);
        if (sub) {
          await api(`/newsletter-subscriptions/${sub.id}`, { method: 'DELETE' });
        }
        setSubscribed(false);
      } else {
        await api('/newsletter-subscriptions', {
          method: 'POST',
          body: JSON.stringify({ sourceType: 'space', sourceId: spaceId }),
        });
        setSubscribed(true);
      }
    } catch { /* ignore */ }
  };

  if (showAnalytics) {
    return <NewsletterAnalytics spaceId={spaceId} onClose={() => setShowAnalytics(false)} />;
  }

  if (selectedNewsletter) {
    return (
      <NewsletterDetail
        newsletter={selectedNewsletter}
        spaceId={spaceId}
        canManage={canManage || selectedNewsletter.authorId === user?.id}
        onClose={() => setSelectedNewsletter(null)}
        onEdit={() => { setEditingNewsletter(selectedNewsletter); setShowEditor(true); setSelectedNewsletter(null); }}
      />
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {showBackButton && onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 8px', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>Back</button>
        )}
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Newsletter</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {subscribed !== null && (
            <button onClick={toggleSubscription} style={{ ...styles.subBtn, background: subscribed ? 'var(--bg-secondary)' : 'var(--accent)', color: subscribed ? 'var(--text-secondary)' : '#fff' }}>
              <Mail size={14} /> {subscribed ? 'Subscribed' : 'Subscribe'}
            </button>
          )}
          {canManage && (
            <>
              <button onClick={() => setShowAnalytics(true)} style={styles.iconBtn} title="Analytics">
                <BarChart3 size={16} />
              </button>
              <button onClick={() => { setEditingNewsletter(null); setShowEditor(true); }} style={styles.newBtn}>
                <Plus size={16} /> New
              </button>
            </>
          )}
        </div>
      </div>

      {canManage && stats && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.drafts}</span>
            <span style={styles.statLabel}>Drafts</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.published}</span>
            <span style={styles.statLabel}>Published</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.subscribers}</span>
            <span style={styles.statLabel}>Subscribers</span>
          </div>
        </div>
      )}

      <div style={styles.list}>
        {loading && newsletters.length === 0 ? (
          <div style={styles.empty}>Loading...</div>
        ) : newsletters.length === 0 ? (
          <div style={styles.empty}>No newsletters yet</div>
        ) : (
          <>
            {newsletters.map((nl) => (
              <button key={nl.id} onClick={() => setSelectedNewsletter(nl)} style={styles.item}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={styles.itemTitle}>{nl.subject}</span>
                    {nl.status === 'draft' && <span style={styles.draftBadge}>Draft</span>}
                  </div>
                  {nl.summary && <p style={styles.itemSummary}>{nl.summary}</p>}
                  <div style={styles.itemMeta}>
                    <span>{nl.author?.displayName}</span>
                    <span>&middot;</span>
                    <span>{nl.publishedAt ? new Date(nl.publishedAt).toLocaleDateString() : 'Unpublished'}</span>
                  </div>
                </div>
                {nl.headerImageUrl && (
                  <img src={nl.headerImageUrl} alt="" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                )}
              </button>
            ))}
            {hasMore && (
              <button onClick={() => loadMore(spaceId)} disabled={loading} style={styles.loadMore}>
                {loading ? 'Loading...' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>

      {showEditor && (
        <NewsletterEditor
          spaceId={spaceId}
          newsletter={editingNewsletter}
          onClose={() => { setShowEditor(false); setEditingNewsletter(null); fetchNewsletters(spaceId); }}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' },
  statsBar: { display: 'flex', borderBottom: '1px solid var(--border)', padding: '10px 16px', gap: 0 },
  statItem: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2 },
  statValue: { fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' },
  statLabel: { fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' as const, color: 'var(--text-muted)', letterSpacing: '0.05em' },
  list: { flex: 1, overflow: 'auto', padding: '8px 0' },
  empty: { textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: '0.9rem' },
  item: { display: 'flex', gap: 12, padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', width: '100%', alignItems: 'center', color: 'inherit' },
  itemTitle: { fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' },
  itemSummary: { margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 },
  itemMeta: { display: 'flex', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 },
  draftBadge: { background: 'var(--bg-secondary)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' },
  newBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  subBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 },
  iconBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px', color: 'var(--text-secondary)', cursor: 'pointer' },
  loadMore: { width: '100%', padding: 12, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.85rem' },
};
