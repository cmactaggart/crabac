import { useState, useEffect } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api.js';
import type { Report } from '@crabac/shared';

interface Props {
  spaceId: string;
}

export function ReportsTab({ spaceId }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'resolved' | 'dismissed' | 'all'>('pending');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const data = await api<Report[]>(`/spaces/${spaceId}/reports${params}`);
      setReports(data);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [spaceId, filter]);

  const handleUpdateStatus = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await api(`/spaces/${spaceId}/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status, resolvedAt: new Date().toISOString() } : r)),
      );
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <div style={styles.filterRow}>
        {(['pending', 'resolved', 'dismissed', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...styles.filterBtn,
              background: filter === f ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: filter === f ? 'white' : 'var(--text-secondary)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading && <div style={styles.empty}>Loading reports...</div>}

      {!loading && reports.length === 0 && (
        <div style={styles.empty}>No {filter !== 'all' ? filter : ''} reports</div>
      )}

      {reports.map((report) => (
        <div key={report.id} style={styles.reportCard}>
          <div style={styles.reportHeader}>
            <AlertTriangle size={14} style={{ color: 'var(--warning, #faa61a)', flexShrink: 0 }} />
            <span style={styles.reportUser}>{report.reportedUser?.displayName || 'Unknown'}</span>
            <span style={styles.reportMeta}>
              reported by {report.reporter?.displayName || 'Unknown'}
            </span>
            <span style={{
              ...styles.statusBadge,
              background: report.status === 'pending' ? 'var(--warning, #faa61a)' :
                         report.status === 'resolved' ? 'var(--success)' : 'var(--text-muted)',
            }}>
              {report.status}
            </span>
          </div>

          <div style={styles.reportReason}>{report.reason}</div>

          {report.messagePreview && (
            <div style={styles.messagePreview}>
              <div style={styles.previewLabel}>
                {report.contentType === 'gallery' ? 'Photo' :
                 report.contentType === 'route' ? 'Route' :
                 report.contentType === 'forum_post' ? 'Forum Post' : 'Message'}
              </div>
              <div style={styles.previewContent}>{report.messagePreview}</div>
            </div>
          )}

          <div style={styles.reportFooter}>
            <span style={styles.reportTime}>
              {new Date(report.createdAt).toLocaleDateString([], {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </span>
            {report.status === 'pending' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => handleUpdateStatus(report.id, 'resolved')}
                  style={styles.resolveBtn}
                >
                  <Check size={14} /> Resolve
                </button>
                <button
                  onClick={() => handleUpdateStatus(report.id, 'dismissed')}
                  style={styles.dismissBtn}
                >
                  <X size={14} /> Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  filterRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 16,
  },
  filterBtn: {
    padding: '5px 12px',
    borderRadius: 'var(--radius)',
    border: 'none',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  empty: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    padding: '2rem',
    fontSize: '0.9rem',
  },
  reportCard: {
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius)',
    padding: '12px',
    marginBottom: 8,
  },
  reportHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reportUser: {
    fontWeight: 700,
    fontSize: '0.9rem',
  },
  reportMeta: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    flex: 1,
  },
  statusBadge: {
    fontSize: '0.65rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    padding: '2px 8px',
    borderRadius: 10,
    color: 'white',
    flexShrink: 0,
  },
  reportReason: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginBottom: 8,
    lineHeight: 1.4,
  },
  messagePreview: {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: '8px',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: '0.65rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: 4,
  },
  previewContent: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: 60,
    overflow: 'hidden',
  },
  reportFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportTime: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  resolveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    background: 'var(--success)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  dismissBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    background: 'var(--text-muted)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
