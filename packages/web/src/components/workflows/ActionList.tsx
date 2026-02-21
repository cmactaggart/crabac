import { useState } from 'react';
import type { WorkflowAction, ActionType } from '@crabac/shared';
import { ActionConfig, ACTION_OPTIONS } from './ActionConfig.js';

interface Props {
  actions: WorkflowAction[];
  onChange: (actions: WorkflowAction[]) => void;
  spaceId: string;
}

export function ActionList({ actions, onChange, spaceId }: Props) {
  const [addingType, setAddingType] = useState<ActionType>('send_message');

  const addAction = () => {
    onChange([...actions, { type: addingType, config: {} }]);
  };

  const updateAction = (index: number, updated: WorkflowAction) => {
    const next = [...actions];
    next[index] = updated;
    onChange(next);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...actions];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const moveDown = (index: number) => {
    if (index === actions.length - 1) return;
    const next = [...actions];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  const ACTION_LABEL: Record<ActionType, string> = Object.fromEntries(
    ACTION_OPTIONS.map((o) => [o.value, o.label])
  ) as Record<ActionType, string>;

  return (
    <div style={styles.container}>
      {actions.length === 0 && (
        <p style={styles.empty}>No actions configured. Add an action below.</p>
      )}

      {actions.map((action, idx) => (
        <div key={idx} style={styles.actionCard}>
          <div style={styles.actionHeader}>
            <div style={styles.actionMeta}>
              <span style={styles.stepBadge}>{idx + 1}</span>
              <select
                value={action.type}
                onChange={(e) =>
                  updateAction(idx, { type: e.target.value as ActionType, config: {} })
                }
                style={styles.typeSelect}
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.actionControls}>
              <button
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
                style={{ ...styles.iconBtn, opacity: idx === 0 ? 0.3 : 1 }}
                title="Move up"
              >
                ▲
              </button>
              <button
                onClick={() => moveDown(idx)}
                disabled={idx === actions.length - 1}
                style={{ ...styles.iconBtn, opacity: idx === actions.length - 1 ? 0.3 : 1 }}
                title="Move down"
              >
                ▼
              </button>
              <button
                onClick={() => removeAction(idx)}
                style={{ ...styles.iconBtn, color: 'var(--danger)' }}
                title="Remove action"
              >
                ×
              </button>
            </div>
          </div>
          <div style={styles.actionBody}>
            <ActionConfig action={action} onChange={(a) => updateAction(idx, a)} spaceId={spaceId} />
          </div>
        </div>
      ))}

      <div style={styles.addRow}>
        <select
          value={addingType}
          onChange={(e) => setAddingType(e.target.value as ActionType)}
          style={styles.addSelect}
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button onClick={addAction} style={styles.addBtn}>
          + Add Action
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  empty: {
    margin: 0,
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: '12px 0',
  },
  actionCard: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
  },
  actionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border)',
    gap: 10,
  },
  actionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  stepBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '0.72rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  typeSelect: {
    flex: 1,
    padding: '4px 8px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
    fontWeight: 500,
    minWidth: 0,
  },
  actionControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  iconBtn: {
    padding: '3px 6px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    borderRadius: 3,
    lineHeight: 1,
  },
  actionBody: {
    padding: 12,
    background: 'var(--bg-secondary)',
  },
  addRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    paddingTop: 4,
  },
  addSelect: {
    flex: 1,
    padding: '7px 10px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
  },
  addBtn: {
    padding: '7px 14px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: '#fff',
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
