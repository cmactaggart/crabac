import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { api } from '../../lib/api.js';
import type { CustomCommand, CommandArg } from '@crabac/shared';

interface Props {
  spaceId: string;
}

const ARG_TYPES = ['text', 'number', 'user', 'channel', 'role', 'boolean'] as const;

function emptyArg(): CommandArg {
  return { name: '', type: 'text', required: false, description: '' };
}

interface FormState {
  name: string;
  description: string;
  args: CommandArg[];
}

function emptyForm(): FormState {
  return { name: '', description: '', args: [] };
}

function ArgEditor({
  arg,
  index,
  onChange,
  onRemove,
}: {
  arg: CommandArg;
  index: number;
  onChange: (index: number, updated: CommandArg) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div style={styles.argRow}>
      <GripVertical size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
      <div style={styles.argFields}>
        <input
          value={arg.name}
          onChange={(e) => onChange(index, { ...arg, name: e.target.value })}
          placeholder="arg-name"
          style={{ ...styles.input, flex: '0 0 120px' }}
        />
        <select
          value={arg.type}
          onChange={(e) => onChange(index, { ...arg, type: e.target.value as CommandArg['type'] })}
          style={{ ...styles.input, flex: '0 0 110px' }}
        >
          {ARG_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          value={arg.description}
          onChange={(e) => onChange(index, { ...arg, description: e.target.value })}
          placeholder="Description"
          style={{ ...styles.input, flex: 1 }}
        />
        <label style={styles.checkLabel}>
          <input
            type="checkbox"
            checked={arg.required}
            onChange={(e) => onChange(index, { ...arg, required: e.target.checked })}
          />
          Required
        </label>
      </div>
      <button onClick={() => onRemove(index)} style={styles.iconBtn} title="Remove arg">
        <Trash2 size={14} style={{ color: 'var(--danger)' }} />
      </button>
    </div>
  );
}

interface CommandFormProps {
  initial?: FormState;
  onSave: (form: FormState) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function CommandForm({ initial, onSave, onCancel, saving }: CommandFormProps) {
  const [form, setForm] = useState<FormState>(initial ?? emptyForm());
  const [error, setError] = useState('');

  const updateArg = (index: number, updated: CommandArg) => {
    setForm((f) => {
      const args = [...f.args];
      args[index] = updated;
      return { ...f, args };
    });
  };

  const removeArg = (index: number) => {
    setForm((f) => ({ ...f, args: f.args.filter((_, i) => i !== index) }));
  };

  const addArg = () => {
    setForm((f) => ({ ...f, args: [...f.args, emptyArg()] }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Command name is required'); return; }
    if (!/^[a-z][a-z0-9-]*$/.test(form.name.trim())) {
      setError('Name must start with a lowercase letter, contain only lowercase letters, numbers, and hyphens');
      return;
    }
    if (!form.description.trim()) { setError('Description is required'); return; }
    for (const arg of form.args) {
      if (!arg.name.trim()) { setError('All args must have a name'); return; }
    }
    setError('');
    await onSave(form);
  };

  return (
    <div style={styles.formCard}>
      <div style={styles.formGrid}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Command Name</label>
          <div style={styles.commandNameWrapper}>
            <span style={styles.commandPrefix}>/</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
              placeholder="my-command"
              style={{ ...styles.input, flex: 1, borderLeft: 'none', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
            />
          </div>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Description</label>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What does this command do?"
            style={styles.input}
          />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={styles.sectionHeader}>
          <span style={styles.label}>Arguments</span>
          <button onClick={addArg} style={styles.addArgBtn}>
            <Plus size={13} /> Add Argument
          </button>
        </div>
        {form.args.length === 0 && (
          <div style={styles.emptyArgs}>No arguments — this command takes no parameters</div>
        )}
        {form.args.map((arg, i) => (
          <ArgEditor key={i} arg={arg} index={i} onChange={updateArg} onRemove={removeArg} />
        ))}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.formActions}>
        <button onClick={handleSubmit} disabled={saving} style={styles.saveBtn}>
          {saving ? 'Saving...' : 'Save Command'}
        </button>
        <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
      </div>
    </div>
  );
}

function CommandCard({
  command,
  onEdit,
  onDelete,
}: {
  command: CustomCommand;
  onEdit: (cmd: CustomCommand) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={styles.commandCard}>
      <div style={styles.commandHeader}>
        <button onClick={() => setExpanded((v) => !v)} style={styles.expandBtn}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <div style={styles.commandInfo}>
          <span style={styles.commandName}>/{command.name}</span>
          <span style={styles.commandDesc}>{command.description}</span>
          {command.args && command.args.length > 0 && (
            <span style={styles.argCount}>{command.args.length} arg{command.args.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div style={styles.cardActions}>
          <button onClick={() => onEdit(command)} style={styles.iconBtn} title="Edit">
            <Pencil size={15} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button onClick={() => onDelete(command.id)} style={styles.iconBtn} title="Delete">
            <Trash2 size={15} style={{ color: 'var(--danger)' }} />
          </button>
        </div>
      </div>

      {expanded && command.args && command.args.length > 0 && (
        <div style={styles.argList}>
          <div style={styles.argListHeader}>
            <span style={styles.argCol}>Name</span>
            <span style={styles.argCol}>Type</span>
            <span style={styles.argColWide}>Description</span>
            <span style={styles.argCol}>Required</span>
          </div>
          {command.args.map((arg, i) => (
            <div key={i} style={styles.argListRow}>
              <span style={{ ...styles.argCol, fontFamily: 'monospace', fontSize: '0.8rem' }}>{arg.name}</span>
              <span style={styles.argCol}>
                <span style={styles.typeBadge}>{arg.type}</span>
              </span>
              <span style={styles.argColWide}>{arg.description || '—'}</span>
              <span style={styles.argCol}>
                {arg.required ? (
                  <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '0.75rem' }}>Yes</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {expanded && (!command.args || command.args.length === 0) && (
        <div style={styles.emptyArgs}>No arguments</div>
      )}
    </div>
  );
}

export function CustomCommandManager({ spaceId }: Props) {
  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomCommand | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchCommands = async () => {
    try {
      const data = await api<CustomCommand[]>(`/spaces/${spaceId}/workflows/commands`);
      setCommands(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCommands(); }, [spaceId]);

  const handleCreate = async (form: FormState) => {
    setSaving(true);
    try {
      await api(`/spaces/${spaceId}/workflows/commands`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          args: form.args.length > 0 ? form.args : null,
        }),
      });
      setShowForm(false);
      fetchCommands();
    } catch (err: any) {
      alert(err?.message || 'Failed to create command');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (form: FormState) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await api(`/spaces/${spaceId}/workflows/commands/${editTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          args: form.args.length > 0 ? form.args : null,
        }),
      });
      setEditTarget(null);
      fetchCommands();
    } catch (err: any) {
      alert(err?.message || 'Failed to update command');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this command? Any workflows using it will need to be updated.')) return;
    try {
      await api(`/spaces/${spaceId}/workflows/commands/${id}`, { method: 'DELETE' });
      setCommands((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err?.message || 'Failed to delete command');
    }
  };

  const openEdit = (cmd: CustomCommand) => {
    setShowForm(false);
    setEditTarget(cmd);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditTarget(null);
  };

  return (
    <div>
      <div style={styles.topBar}>
        <p style={styles.description}>
          Custom slash commands can be used as workflow triggers. Define the command name and the arguments users can pass.
        </p>
        {!showForm && !editTarget && (
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>
            <Plus size={16} /> New Command
          </button>
        )}
      </div>

      {showForm && (
        <CommandForm
          onSave={handleCreate}
          onCancel={cancelForm}
          saving={saving}
        />
      )}

      {loading && <div style={styles.empty}>Loading commands...</div>}

      {!loading && commands.length === 0 && !showForm && (
        <div style={styles.empty}>No custom commands yet. Create one to use as a workflow trigger.</div>
      )}

      {commands.map((cmd) => (
        editTarget?.id === cmd.id ? (
          <CommandForm
            key={cmd.id}
            initial={{ name: cmd.name, description: cmd.description, args: cmd.args ?? [] }}
            onSave={handleEdit}
            onCancel={cancelForm}
            saving={saving}
          />
        ) : (
          <CommandCard
            key={cmd.id}
            command={cmd}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        )
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topBar: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  description: {
    margin: 0,
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  empty: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    padding: '2rem',
    fontSize: '0.9rem',
  },
  commandCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  commandHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
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
  commandInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    flexWrap: 'wrap' as const,
    minWidth: 0,
  },
  commandName: {
    fontFamily: 'monospace',
    fontWeight: 700,
    fontSize: '0.95rem',
    color: 'var(--accent)',
  },
  commandDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    flex: 1,
  },
  argCount: {
    fontSize: '0.7rem',
    fontWeight: 600,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
    padding: '2px 8px',
    borderRadius: 10,
  },
  cardActions: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: 'var(--radius)',
    display: 'flex',
    alignItems: 'center',
  },
  argList: {
    borderTop: '1px solid var(--border)',
    padding: '8px 12px',
    background: 'var(--bg-primary)',
  },
  argListHeader: {
    display: 'flex',
    gap: 8,
    padding: '4px 0',
    borderBottom: '1px solid var(--border)',
    marginBottom: 4,
  },
  argListRow: {
    display: 'flex',
    gap: 8,
    padding: '4px 0',
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
  },
  argCol: {
    flex: '0 0 100px',
    fontSize: '0.72rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
  },
  argColWide: {
    flex: 1,
    fontSize: '0.72rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
  },
  typeBadge: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    padding: '1px 6px',
    borderRadius: 4,
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  emptyArgs: {
    padding: '8px 12px',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-primary)',
  },
  // Form
  formCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius)',
    padding: '16px',
    marginBottom: 12,
  },
  formGrid: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    flex: 1,
    minWidth: 200,
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
  },
  commandNameWrapper: {
    display: 'flex',
    alignItems: 'stretch',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
  },
  commandPrefix: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 10px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
    fontWeight: 700,
    fontSize: '1rem',
    borderRight: '1px solid var(--border)',
  },
  input: {
    padding: '8px 12px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  addArgBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  argRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '8px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    marginBottom: 6,
  },
  argFields: {
    display: 'flex',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  error: {
    marginTop: 10,
    padding: '8px 12px',
    background: 'rgba(237,66,69,0.1)',
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius)',
    color: 'var(--danger)',
    fontSize: '0.82rem',
  },
  formActions: {
    display: 'flex',
    gap: 8,
    marginTop: 14,
  },
  saveBtn: {
    padding: '8px 18px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '8px 16px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
};
