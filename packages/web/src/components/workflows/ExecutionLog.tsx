import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, AlertCircle, CheckCircle, Clock, SkipForward } from 'lucide-react';
import { api } from '../../lib/api.js';
import type { WorkflowExecution } from '@crabac/shared';

interface Props {
  spaceId: string;
}

interface Workflow {
  id: string;
  name: string;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_CONFIG: Record<
  WorkflowExecution['status'],
  { label: string; color: string; bg: string; Icon: React.FC<any> }
> = {
  success: {
    label: 'Success',
    color: '#3ba55c',
    bg: 'rgba(59,165,92,0.15)',
    Icon: CheckCircle,
  },
  partial: {
    label: 'Partial',
    color: '#faa61a',
    bg: 'rgba(250,166,26,0.15)',
    Icon: AlertCircle,
  },
  error: {
    label: 'Error',
    color: 'var(--danger)',
    bg: 'rgba(237,66,69,0.12)',
    Icon: AlertCircle,
  },
  skipped: {
    label: 'Skipped',
    color: 'var(--text-muted)',
    bg: 'var(--bg-tertiary)',
    Icon: SkipForward,
  },
};

function StatusBadge({ status }: { status: WorkflowExecution['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 10,
        fontSize: '0.7rem',
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.03em',
        color: cfg.color,
        background: cfg.bg,
        whiteSpace: 'nowrap' as const,
      }}
    >
      <cfg.Icon size={11} />
      {cfg.label}
    </span>
  );
}

function ExecutionRow({ execution }: { execution: WorkflowExecution }) {
  const [expanded, setExpanded] = useState(false);
  const hasTriggerData = execution.triggerData && Object.keys(execution.triggerData).length > 0;

  return (
    <div style={styles.execRow}>
      <div style={styles.execHeader}>
        <button onClick={() => setExpanded((v) => !v)} style={styles.expandBtn} title="Expand">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <StatusBadge status={execution.status} />

        <div style={styles.execMeta}>
          <span style={styles.workflowName}>{execution.workflowName ?? `Workflow ${execution.workflowId.slice(-6)}`}</span>
          <span style={styles.triggerType}>
            trigger: <code style={styles.code}>{execution.triggerType}</code>
          </span>
        </div>

        <div style={styles.execStats}>
          {execution.actionsTotal > 0 && (
            <span style={styles.statChip}>
              {execution.actionsRun}/{execution.actionsTotal} actions
            </span>
          )}
          <span style={styles.duration}>
            <Clock size={11} style={{ verticalAlign: 'middle' }} /> {formatDuration(execution.durationMs)}
          </span>
          <span style={styles.timestamp}>{formatTimestamp(execution.startedAt)}</span>
        </div>
      </div>

      {expanded && (
        <div style={styles.execDetail}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Started</span>
            <span style={styles.detailValue}>{new Date(execution.startedAt).toLocaleString()}</span>
          </div>
          {execution.finishedAt && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Finished</span>
              <span style={styles.detailValue}>{new Date(execution.finishedAt).toLocaleString()}</span>
            </div>
          )}
          {execution.triggerUserId && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Triggered by</span>
              <span style={styles.detailValue}>
                <code style={styles.code}>{execution.triggerUserId}</code>
              </span>
            </div>
          )}

          {execution.errorMessage && (
            <div style={styles.errorBlock}>
              <div style={styles.errorLabel}>Error</div>
              <div style={styles.errorText}>{execution.errorMessage}</div>
            </div>
          )}

          {hasTriggerData && (
            <div style={styles.jsonBlock}>
              <div style={styles.jsonLabel}>Trigger Data</div>
              <pre style={styles.jsonPre}>{JSON.stringify(execution.triggerData, null, 2)}</pre>
            </div>
          )}

          {!hasTriggerData && !execution.errorMessage && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No additional details
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ExecutionLog({ spaceId }: Props) {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filterWorkflowId, setFilterWorkflowId] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const LIMIT = 50;

  const fetchWorkflows = async () => {
    try {
      const data = await api<Workflow[]>(`/spaces/${spaceId}/workflows`);
      setWorkflows(data);
    } catch {
      // ignore
    }
  };

  const buildUrl = (before?: string) => {
    const params = new URLSearchParams();
    if (filterWorkflowId) params.set('workflowId', filterWorkflowId);
    params.set('limit', String(LIMIT));
    if (before) params.set('before', before);
    return `/spaces/${spaceId}/workflows/executions?${params.toString()}`;
  };

  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<WorkflowExecution[]>(buildUrl());
      setExecutions(data);
      setHasMore(data.length === LIMIT);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [spaceId, filterWorkflowId]);

  const loadMore = async () => {
    if (executions.length === 0 || loadingMore) return;
    const cursor = executions[executions.length - 1].id;
    setLoadingMore(true);
    try {
      const data = await api<WorkflowExecution[]>(buildUrl(cursor));
      setExecutions((prev) => [...prev, ...data]);
      setHasMore(data.length === LIMIT);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await fetchExecutions();
    setRefreshing(false);
  };

  useEffect(() => { fetchWorkflows(); }, [spaceId]);
  useEffect(() => { fetchExecutions(); }, [fetchExecutions]);

  const statusGroups = executions.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Workflow</label>
          <select
            value={filterWorkflowId}
            onChange={(e) => setFilterWorkflowId(e.target.value)}
            style={styles.select}
          >
            <option value="">All workflows</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <button onClick={refresh} disabled={refreshing || loading} style={styles.refreshBtn} title="Refresh">
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Summary chips */}
      {!loading && executions.length > 0 && (
        <div style={styles.summaryRow}>
          {(Object.entries(statusGroups) as [WorkflowExecution['status'], number][]).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status];
            return (
              <span key={status} style={{ ...styles.summaryChip, color: cfg.color, background: cfg.bg }}>
                {count} {cfg.label.toLowerCase()}
              </span>
            );
          })}
          <span style={styles.summaryTotal}>{executions.length} shown</span>
        </div>
      )}

      {/* List */}
      {loading && <div style={styles.empty}>Loading execution log...</div>}

      {!loading && executions.length === 0 && (
        <div style={styles.empty}>
          No executions found{filterWorkflowId ? ' for this workflow' : ''}. Workflows will appear here after they run.
        </div>
      )}

      {executions.map((exec) => (
        <ExecutionRow key={exec.id} execution={exec} />
      ))}

      {hasMore && (
        <button onClick={loadMore} disabled={loadingMore} style={styles.loadMoreBtn}>
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap' as const,
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 180,
  },
  filterLabel: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap' as const,
  },
  select: {
    flex: 1,
    padding: '7px 10px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  summaryRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap' as const,
  },
  summaryChip: {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 10,
  },
  summaryTotal: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    marginLeft: 'auto',
  },
  empty: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    padding: '2rem',
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
  execRow: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    marginBottom: 6,
    overflow: 'hidden',
  },
  execHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    flexWrap: 'wrap' as const,
  },
  expandBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  execMeta: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    flex: 1,
    minWidth: 120,
  },
  workflowName: {
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--text-primary)',
  },
  triggerType: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '0.78em',
    background: 'var(--bg-tertiary)',
    padding: '0 3px',
    borderRadius: 3,
  },
  execStats: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    flexWrap: 'wrap' as const,
  },
  statChip: {
    fontSize: '0.72rem',
    color: 'var(--text-secondary)',
    background: 'var(--bg-tertiary)',
    padding: '2px 7px',
    borderRadius: 8,
  },
  duration: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },
  timestamp: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap' as const,
  },
  execDetail: {
    borderTop: '1px solid var(--border)',
    padding: '10px 14px',
    background: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  detailRow: {
    display: 'flex',
    gap: 10,
    fontSize: '0.82rem',
  },
  detailLabel: {
    flex: '0 0 90px',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
  },
  detailValue: {
    color: 'var(--text-secondary)',
    flex: 1,
  },
  errorBlock: {
    background: 'rgba(237,66,69,0.08)',
    border: '1px solid rgba(237,66,69,0.3)',
    borderRadius: 'var(--radius)',
    padding: '8px 10px',
  },
  errorLabel: {
    fontSize: '0.68rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    color: 'var(--danger)',
    marginBottom: 4,
  },
  errorText: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  jsonBlock: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '8px 10px',
  },
  jsonLabel: {
    fontSize: '0.68rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
    marginBottom: 6,
  },
  jsonPre: {
    margin: 0,
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    color: 'var(--text-secondary)',
    overflowX: 'auto' as const,
    whiteSpace: 'pre' as const,
    maxHeight: 200,
    overflow: 'auto',
  },
  loadMoreBtn: {
    display: 'block',
    width: '100%',
    padding: '10px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
    textAlign: 'center' as const,
  },
};
