import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNewsletterStore } from '../../stores/newsletter.js';

interface Props {
  spaceId: string;
  onClose: () => void;
}

export function NewsletterAnalytics({ spaceId, onClose }: Props) {
  const { analytics, fetchAnalytics } = useNewsletterStore();

  useEffect(() => {
    fetchAnalytics(spaceId);
  }, [spaceId, fetchAnalytics]);

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <button onClick={onClose} style={styles.backBtn}>
          <ArrowLeft size={16} /> Back
        </button>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Newsletter Analytics</h3>
        <div />
      </div>

      <div style={styles.content}>
        {analytics.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No published newsletters yet</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Subject</th>
                <th style={styles.thNum}>Sent</th>
                <th style={styles.thNum}>Opens</th>
                <th style={styles.thNum}>Rate</th>
                <th style={styles.thNum}>Clicks</th>
                <th style={styles.thNum}>Date</th>
              </tr>
            </thead>
            <tbody>
              {analytics.map((stat) => {
                const openRate = stat.totalSent > 0 ? Math.round((stat.uniqueOpens / stat.totalSent) * 100) : 0;
                return (
                  <tr key={stat.newsletterId}>
                    <td style={styles.td}>{stat.subject}</td>
                    <td style={styles.tdNum}>{stat.totalSent}</td>
                    <td style={styles.tdNum}>{stat.uniqueOpens}</td>
                    <td style={styles.tdNum}>{openRate}%</td>
                    <td style={styles.tdNum}>{stat.uniqueClicks}</td>
                    <td style={styles.tdNum}>{stat.publishedAt ? new Date(stat.publishedAt).toLocaleDateString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' },
  content: { flex: 1, overflow: 'auto', padding: '16px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem' },
  thNum: { textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' },
  tdNum: { textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' },
};
