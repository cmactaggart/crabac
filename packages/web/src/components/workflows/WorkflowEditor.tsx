import { useState } from 'react';
import type { Workflow, TriggerType, ConditionGroup, WorkflowAction } from '@crabac/shared';
import { api } from '../../lib/api.js';
import { TriggerSelector } from './TriggerSelector.js';
import { ConditionBuilder } from './ConditionBuilder.js';
import { ActionList } from './ActionList.js';
import { VariableHelp } from './VariableHelp.js';

interface Props {
  spaceId: string;
  workflow?: Workflow | null;
  onSave: () => void;
  onCancel: () => void;
}

type Section = 'trigger' | 'conditions' | 'actions';

export function WorkflowEditor({ spaceId, workflow, onSave, onCancel }: Props) {
  const isEdit = Boolean(workflow);

  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [triggerType, setTriggerType] = useState<TriggerType>(
    workflow?.triggerType || 'message_created'
  );
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any> | null>(
    workflow?.triggerConfig || null
  );
  const [conditions, setConditions] = useState<ConditionGroup | null>(
    workflow?.conditions || null
  );
  const [actions, setActions] = useState<WorkflowAction[]>(workflow?.actions || []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openSection, setOpenSection] = useState<Section | null>('trigger');

  const handleTriggerChange = (type: TriggerType, config: Record<string, any> | null) => {
    setTriggerType(type);
    setTriggerConfig(config);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Workflow name is required.');
      return;
    }
    if (actions.length === 0) {
      setError('At least one action is required.');
      return;
    }

    setError('');
    setSaving(true);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      triggerType,
      triggerConfig: triggerConfig || null,
      conditions: conditions || null,
      actions,
    };

    try {
      if (isEdit && workflow) {
        await api(`/spaces/${spaceId}/workflows/details/${workflow.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/spaces/${spaceId}/workflows`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to save workflow.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: Section) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>{isEdit ? 'Edit Workflow' : 'New Workflow'}</h3>
      </div>

      {/* Name & Description */}
      <div style={styles.section}>
        <div style={styles.field}>
          <label style={styles.label}>Workflow Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Welcome new members"
            style={styles.input}
            maxLength={100}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of what this workflow does"
            rows={2}
            style={styles.textarea}
            maxLength={500}
          />
        </div>
      </div>

      {/* Trigger */}
      <div style={styles.collapsible}>
        <button
          style={styles.sectionToggle}
          onClick={() => toggleSection('trigger')}
        >
          <span style={styles.sectionIcon}>{openSection === 'trigger' ? '▾' : '▸'}</span>
          <span style={styles.sectionTitle}>Trigger</span>
          <span style={styles.sectionSummary}>
            {triggerType.replace(/_/g, ' ')}
          </span>
        </button>
        {openSection === 'trigger' && (
          <div style={styles.sectionBody}>
            <TriggerSelector
              triggerType={triggerType}
              triggerConfig={triggerConfig}
              onChange={handleTriggerChange}
              spaceId={spaceId}
            />
            <div style={{ marginTop: 12 }}>
              <VariableHelp triggerType={triggerType} />
            </div>
          </div>
        )}
      </div>

      {/* Conditions */}
      <div style={styles.collapsible}>
        <button
          style={styles.sectionToggle}
          onClick={() => toggleSection('conditions')}
        >
          <span style={styles.sectionIcon}>{openSection === 'conditions' ? '▾' : '▸'}</span>
          <span style={styles.sectionTitle}>Conditions</span>
          <span style={styles.sectionSummary}>
            {conditions ? `${conditions.rules.length} rule(s)` : 'Always run'}
          </span>
        </button>
        {openSection === 'conditions' && (
          <div style={styles.sectionBody}>
            <ConditionBuilder
              conditions={conditions}
              onChange={setConditions}
              spaceId={spaceId}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={styles.collapsible}>
        <button
          style={styles.sectionToggle}
          onClick={() => toggleSection('actions')}
        >
          <span style={styles.sectionIcon}>{openSection === 'actions' ? '▾' : '▸'}</span>
          <span style={styles.sectionTitle}>Actions</span>
          <span style={styles.sectionSummary}>
            {actions.length > 0 ? `${actions.length} action(s)` : 'None configured'}
          </span>
        </button>
        {openSection === 'actions' && (
          <div style={styles.sectionBody}>
            <ActionList actions={actions} onChange={setActions} spaceId={spaceId} />
          </div>
        )}
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.footer}>
        <button onClick={onCancel} style={styles.cancelBtn} disabled={saving}>
          Cancel
        </button>
        <button onClick={handleSave} style={styles.saveBtn} disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Workflow'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  header: {
    padding: '14px 16px 10px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  title: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  section: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    borderBottom: '1px solid var(--border)',
  },
  collapsible: {
    borderBottom: '1px solid var(--border)',
  },
  sectionToggle: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 16px',
    background: 'var(--bg-secondary)',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  },
  sectionIcon: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  sectionTitle: {
    flex: 1,
  },
  sectionSummary: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: 400,
  },
  sectionBody: {
    padding: '12px 16px 14px',
    background: 'var(--bg-primary)',
    borderTop: '1px solid var(--border)',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  input: {
    padding: '8px 10px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.92rem',
  },
  textarea: {
    padding: '8px 10px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.92rem',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  error: {
    margin: 0,
    padding: '10px 16px',
    color: 'var(--danger)',
    fontSize: '0.85rem',
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '12px 16px',
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
  },
  cancelBtn: {
    padding: '8px 16px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 18px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
