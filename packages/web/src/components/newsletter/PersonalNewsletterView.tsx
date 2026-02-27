import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Newsletter } from '@crabac/shared';
import { useNewsletterStore } from '../../stores/newsletter.js';
import { NewsletterDetail } from './NewsletterDetail.js';
import { NewsletterEditor } from './NewsletterEditor.js';

export function PersonalNewsletterView() {
  const { newsletters, loading, hasMore, fetchPersonalNewsletters, loadMorePersonal, selectedNewsletter, setSelectedNewsletter, deletePersonalNewsletter } = useNewsletterStore();
  const [showEditor, setShowEditor] = useState(false);
  const [editingNewsletter, setEditingNewsletter] = useState<Newsletter | null>(null);

  useEffect(() => {
    fetchPersonalNewsletters();
    return () => useNewsletterStore.getState().clear();
  }, [fetchPersonalNewsletters]);

  if (selectedNewsletter) {
    return (
      <NewsletterDetail
        newsletter={selectedNewsletter}
        canManage={true}
        onClose={() => setSelectedNewsletter(null)}
        onEdit={() => { setEditingNewsletter(selectedNewsletter); setShowEditor(true); setSelectedNewsletter(null); }}
        onDelete={async () => { await deletePersonalNewsletter(selectedNewsletter.id); setSelectedNewsletter(null); }}
      />
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>My Newsletters</h3>
        <button onClick={() => { setEditingNewsletter(null); setShowEditor(true); }} style={styles.newBtn}>
          <Plus size={16} /> New
        </button>
      </div>

      <div style={styles.list}>
        {loading && newsletters.length === 0 ? (
          <div style={styles.empty}>Loading...</div>
        ) : newsletters.length === 0 ? (
          <div style={styles.empty}>No newsletters yet. Create your first one!</div>
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
                    <span>{nl.publishedAt ? new Date(nl.publishedAt).toLocaleDateString() : 'Unpublished'}</span>
                  </div>
                </div>
                {nl.headerImageUrl && (
                  <img src={nl.headerImageUrl} alt="" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                )}
              </button>
            ))}
            {hasMore && (
              <button onClick={() => loadMorePersonal()} disabled={loading} style={styles.loadMore}>
                {loading ? 'Loading...' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>

      {showEditor && (
        <NewsletterEditor
          spaceId={null}
          newsletter={editingNewsletter}
          onClose={() => { setShowEditor(false); setEditingNewsletter(null); fetchPersonalNewsletters(); }}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  list: { display: 'flex', flexDirection: 'column' },
  empty: { textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: '0.9rem' },
  item: { display: 'flex', gap: 12, padding: '12px 16px', background: 'var(--bg-secondary)', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', width: '100%', alignItems: 'center', color: 'inherit', borderRadius: 'var(--radius)', marginBottom: 4 },
  itemTitle: { fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' },
  itemSummary: { margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 },
  itemMeta: { display: 'flex', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 },
  draftBadge: { background: 'var(--bg-tertiary)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' },
  newBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  loadMore: { width: '100%', padding: 12, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.85rem' },
};
