import { useState, useEffect } from 'react';
import type { Workflow, TriggerType } from '@crabac/shared';
import { api } from '../../lib/api.js';
import { WorkflowEditor } from './WorkflowEditor.js';

interface Props {
  spaceId: string;
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  member_joined: 'Member Joined',
  message_created: 'Message Created',
  image_uploaded: 'Image Uploaded',
  gpx_uploaded: 'GPX Uploaded',
  slash_command: 'Slash Command',
  card_interaction: 'Card Interaction',
  webhook: 'Webhook',
};

const TRIGGER_COLORS: Record<TriggerType, string> = {
  member_joined: '#3ba55d',
  message_created: '#5865f2',
  image_uploaded: '#eb459e',
  gpx_uploaded: '#f5a623',
  slash_command: '#9b59b6',
  card_interaction: '#1abc9c',
  webhook: '#e67e22',
};

export function WorkflowList({ spaceId }: Props) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Workflow | null | 'new'>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const fetchWorkflows = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<Workflow[]>(`/spaces/${spaceId}/workflows`);
      setWorkflows(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load workflows.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, [spaceId]);

  const handleToggle = async (workflow: Workflow) => {
    setToggling((prev) => new Set(prev).add(workflow.id));
    try {
      const updated = await api<Workflow>(
        `/spaces/${spaceId}/workflows/details/${workflow.id}/toggle`,
        { method: 'PATCH' }
      );
      setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch {
      // ignore — UI stays in old state
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(workflow.id);
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/spaces/${spaceId}/workflows/details/${id}`, { method: 'DELETE' });
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      setConfirmDelete(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete workflow.');
    }
  };

  const handleSave = () => {
    setEditing(null);
    fetchWorkflows();
  };

  if (editing !== null) {
    return (
      <WorkflowEditor
        spaceId={spaceId}
        workflow={editing === 'new' ? null : editing}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div>
          <h4 style={styles.heading}>Workflows</h4>
          <p style={styles.subheading}>
            Automate actions in response to events in your space.
          </p>
        </div>
        <button onClick={() => setEditing('new')} style={styles.createBtn}>
          + Create Workflow
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {loading ? (
        <p style={styles.empty}>Loading...</p>
      ) : workflows.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>No workflows yet</p>
          <p style={styles.emptyDesc}>
            Create a workflow to automate actions like welcoming new members, assigning roles, or posting messages.
          </p>
        </div>
      ) : (
        <div style={styles.list}>
          {workflows.map((wf) => (
            <div key={wf.id} style={styles.workflowCard}>
              <div style={styles.cardLeft}>
                <span
                  style={{
                    ...styles.triggerBadge,
                    background: TRIGGER_COLORS[wf.triggerType] + '22',
                    color: TRIGGER_COLORS[wf.triggerType],
                    borderColor: TRIGGER_COLORS[wf.triggerType] + '44',
                  }}
                >
                  {TRIGGER_LABELS[wf.triggerType]}
                </span>
                <div style={styles.cardInfo}>
                  <span style={styles.workflowName}>{wf.name}</span>
                  {wf.description && (
                    <span style={styles.workflowDesc}>{wf.description}</span>
                  )}
                </div>
              </div>

              <div style={styles.cardRight}>
                <span style={styles.actionCount}>
                  {wf.actions.length} action{wf.actions.length !== 1 ? 's' : ''}
                </span>

                {/* Toggle */}
                <button
                  onClick={() => handleToggle(wf)}
                  disabled={toggling.has(wf.id)}
                  style={{
                    ...styles.toggleBtn,
                    background: wf.enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
                    borderColor: wf.enabled ? 'var(--accent)' : 'var(--border)',
                  }}
                  title={wf.enabled ? 'Disable workflow' : 'Enable workflow'}
                >
                  <span
                    style={{
                      ...styles.toggleKnob,
                      transform: wf.enabled ? 'translateX(14px)' : 'translateX(2px)',
                    }}
                  />
                </button>

                <button
                  onClick={() => setEditing(wf)}
                  style={styles.editBtn}
                >
                  Edit
                </button>

                {confirmDelete === wf.id ? (
                  <div style={styles.confirmRow}>
                    <span style={styles.confirmText}>Delete?</span>
                    <button
                      onClick={() => handleDelete(wf.id)}
                      style={styles.confirmYesBtn}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      style={styles.confirmNoBtn}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(wf.id)}
                    style={styles.deleteBtn}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heading: {
    margin: '0 0 2px',
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  subheading: {
    margin: 0,
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  createBtn: {
    padding: '8px 14px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: '#fff',
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  error: {
    margin: 0,
    padding: '8px 12px',
    background: '#f003',
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius)',
    color: 'var(--danger)',
    fontSize: '0.85rem',
  },
  empty: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  emptyState: {
    padding: '24px',
    textAlign: 'center',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-secondary)',
  },
  emptyTitle: {
    margin: '0 0 6px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
  },
  emptyDesc: {
    margin: 0,
    fontSize: '0.83rem',
    color: 'var(--text-muted)',
    maxWidth: 400,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  workflowCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    gap: 12,
    flexWrap: 'wrap',
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  triggerBadge: {
    padding: '3px 8px',
    borderRadius: 100,
    fontSize: '0.72rem',
    fontWeight: 700,
    border: '1px solid',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    letterSpacing: '0.02em',
  },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  workflowName: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  workflowDesc: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  actionCount: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  toggleBtn: {
    position: 'relative',
    width: 32,
    height: 18,
    borderRadius: 100,
    border: '1px solid',
    cursor: 'pointer',
    transition: 'background 0.2s, border-color 0.2s',
    padding: 0,
    flexShrink: 0,
  },
  toggleKnob: {
    position: 'absolute',
    top: 2,
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: '#fff',
    transition: 'transform 0.2s',
  },
  editBtn: {
    padding: '5px 10px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: '0.82rem',
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '5px 10px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--danger)',
    fontSize: '0.82rem',
    cursor: 'pointer',
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  confirmText: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
  },
  confirmYesBtn: {
    padding: '4px 8px',
    background: 'var(--danger)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: '#fff',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmNoBtn: {
    padding: '4px 8px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: '0.78rem',
    cursor: 'pointer',
  },
};
