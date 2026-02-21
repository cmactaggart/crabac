import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import type { CardTemplate, CardField, CardButton } from '@crabac/shared';

interface Props {
  spaceId: string;
}

const FIELD_TYPES = ['text', 'select', 'role', 'user', 'channel'] as const;
const BUTTON_STYLES = ['primary', 'secondary', 'danger'] as const;

function emptyField(): CardField {
  return { key: '', label: '', type: 'text', options: [] };
}

function emptyButton(): CardButton {
  return { id: '', label: '', style: 'primary' };
}

interface FormState {
  name: string;
  titleTemplate: string;
  bodyTemplate: string;
  color: string;
  fields: CardField[];
  buttons: CardButton[];
}

function emptyForm(): FormState {
  return {
    name: '',
    titleTemplate: '',
    bodyTemplate: '',
    color: '#5865f2',
    fields: [],
    buttons: [],
  };
}

function templateFromCard(card: CardTemplate): FormState {
  return {
    name: card.name,
    titleTemplate: card.titleTemplate,
    bodyTemplate: card.bodyTemplate ?? '',
    color: card.color ?? '#5865f2',
    fields: card.fields ?? [],
    buttons: card.buttons ?? [],
  };
}

// ------------------------------------------------------------------
// Sub-editors
// ------------------------------------------------------------------

function FieldEditor({
  field,
  index,
  onChange,
  onRemove,
}: {
  field: CardField;
  index: number;
  onChange: (i: number, f: CardField) => void;
  onRemove: (i: number) => void;
}) {
  const [optionInput, setOptionInput] = useState('');

  const addOption = () => {
    const val = optionInput.trim();
    if (!val) return;
    onChange(index, { ...field, options: [...(field.options ?? []), val] });
    setOptionInput('');
  };

  const removeOption = (oi: number) => {
    onChange(index, { ...field, options: (field.options ?? []).filter((_, i) => i !== oi) });
  };

  return (
    <div style={styles.subRow}>
      <div style={styles.subRowHeader}>
        <input
          value={field.key}
          onChange={(e) => onChange(index, { ...field, key: e.target.value.replace(/\s/g, '_') })}
          placeholder="field_key"
          style={{ ...styles.input, flex: '0 0 120px', fontFamily: 'monospace', fontSize: '0.8rem' }}
        />
        <input
          value={field.label}
          onChange={(e) => onChange(index, { ...field, label: e.target.value })}
          placeholder="Display Label"
          style={{ ...styles.input, flex: 1 }}
        />
        <select
          value={field.type}
          onChange={(e) => onChange(index, { ...field, type: e.target.value as CardField['type'] })}
          style={{ ...styles.input, flex: '0 0 90px' }}
        >
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => onRemove(index)} style={styles.iconBtn} title="Remove field">
          <X size={14} style={{ color: 'var(--danger)' }} />
        </button>
      </div>

      {field.type === 'select' && (
        <div style={styles.optionsArea}>
          <div style={styles.optionChips}>
            {(field.options ?? []).map((opt, oi) => (
              <span key={oi} style={styles.chip}>
                {opt}
                <button onClick={() => removeOption(oi)} style={styles.chipRemove}><X size={10} /></button>
              </span>
            ))}
          </div>
          <div style={styles.optionAddRow}>
            <input
              value={optionInput}
              onChange={(e) => setOptionInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
              placeholder="Add option..."
              style={{ ...styles.input, flex: 1 }}
            />
            <button onClick={addOption} style={styles.addArgBtn}>Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ButtonEditor({
  button,
  index,
  onChange,
  onRemove,
}: {
  button: CardButton;
  index: number;
  onChange: (i: number, b: CardButton) => void;
  onRemove: (i: number) => void;
}) {
  const styleColor: Record<CardButton['style'], string> = {
    primary: 'var(--accent)',
    secondary: 'var(--bg-tertiary)',
    danger: 'var(--danger)',
  };

  return (
    <div style={styles.subRow}>
      <div style={styles.subRowHeader}>
        <input
          value={button.id}
          onChange={(e) => onChange(index, { ...button, id: e.target.value.replace(/\s/g, '_') })}
          placeholder="button_id"
          style={{ ...styles.input, flex: '0 0 120px', fontFamily: 'monospace', fontSize: '0.8rem' }}
        />
        <input
          value={button.label}
          onChange={(e) => onChange(index, { ...button, label: e.target.value })}
          placeholder="Button Label"
          style={{ ...styles.input, flex: 1 }}
        />
        <select
          value={button.style}
          onChange={(e) => onChange(index, { ...button, style: e.target.value as CardButton['style'] })}
          style={{ ...styles.input, flex: '0 0 105px', color: styleColor[button.style] }}
        >
          {BUTTON_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => onRemove(index)} style={styles.iconBtn} title="Remove button">
          <X size={14} style={{ color: 'var(--danger)' }} />
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Main form
// ------------------------------------------------------------------

interface CardFormProps {
  initial?: FormState;
  onSave: (form: FormState) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function CardForm({ initial, onSave, onCancel, saving }: CardFormProps) {
  const [form, setForm] = useState<FormState>(initial ?? emptyForm());
  const [error, setError] = useState('');

  const updateField = (i: number, f: CardField) => {
    setForm((prev) => { const fields = [...prev.fields]; fields[i] = f; return { ...prev, fields }; });
  };
  const removeField = (i: number) => {
    setForm((prev) => ({ ...prev, fields: prev.fields.filter((_, idx) => idx !== i) }));
  };
  const updateButton = (i: number, b: CardButton) => {
    setForm((prev) => { const buttons = [...prev.buttons]; buttons[i] = b; return { ...prev, buttons }; });
  };
  const removeButton = (i: number) => {
    setForm((prev) => ({ ...prev, buttons: prev.buttons.filter((_, idx) => idx !== i) }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.titleTemplate.trim()) { setError('Title template is required'); return; }
    for (const f of form.fields) {
      if (!f.key.trim() || !f.label.trim()) { setError('All fields must have a key and label'); return; }
    }
    for (const b of form.buttons) {
      if (!b.id.trim() || !b.label.trim()) { setError('All buttons must have an ID and label'); return; }
    }
    setError('');
    await onSave(form);
  };

  return (
    <div style={styles.formCard}>
      {/* Row 1: name + color */}
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Template Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="My Card Template"
            style={styles.input}
          />
        </div>
        <div style={{ ...styles.formGroup, flex: '0 0 130px' }}>
          <label style={styles.label}>Accent Color</label>
          <div style={styles.colorRow}>
            <input
              type="color"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              style={styles.colorPicker}
            />
            <input
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              placeholder="#5865f2"
              maxLength={7}
              style={{ ...styles.input, flex: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}
            />
          </div>
        </div>
      </div>

      {/* Row 2: title template */}
      <div style={styles.formGroup}>
        <label style={styles.label}>
          Title Template <span style={styles.hint}>supports {'{{variable}}'} interpolation</span>
        </label>
        <input
          value={form.titleTemplate}
          onChange={(e) => setForm((f) => ({ ...f, titleTemplate: e.target.value }))}
          placeholder="e.g. New request from {{user}}"
          style={styles.input}
        />
      </div>

      {/* Row 3: body template */}
      <div style={styles.formGroup}>
        <label style={styles.label}>
          Body Template <span style={styles.hint}>markdown supported, {'{{vars}}'} allowed</span>
        </label>
        <textarea
          value={form.bodyTemplate}
          onChange={(e) => setForm((f) => ({ ...f, bodyTemplate: e.target.value }))}
          placeholder="Optional body text..."
          rows={4}
          style={{ ...styles.input, resize: 'vertical', lineHeight: 1.5 }}
        />
      </div>

      {/* Fields section */}
      <div style={styles.sectionWrap}>
        <div style={styles.sectionHeader}>
          <span style={styles.label}>Fields</span>
          <button
            onClick={() => setForm((f) => ({ ...f, fields: [...f.fields, emptyField()] }))}
            style={styles.addArgBtn}
          >
            <Plus size={13} /> Add Field
          </button>
        </div>
        {form.fields.length === 0 && <div style={styles.emptyHint}>No fields — card will only show title and body</div>}
        {form.fields.map((field, i) => (
          <FieldEditor key={i} field={field} index={i} onChange={updateField} onRemove={removeField} />
        ))}
      </div>

      {/* Buttons section */}
      <div style={styles.sectionWrap}>
        <div style={styles.sectionHeader}>
          <span style={styles.label}>Buttons</span>
          <button
            onClick={() => setForm((f) => ({ ...f, buttons: [...f.buttons, emptyButton()] }))}
            style={styles.addArgBtn}
          >
            <Plus size={13} /> Add Button
          </button>
        </div>
        {form.buttons.length === 0 && <div style={styles.emptyHint}>No buttons — card will be display-only</div>}
        {form.buttons.map((btn, i) => (
          <ButtonEditor key={i} button={btn} index={i} onChange={updateButton} onRemove={removeButton} />
        ))}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.formActions}>
        <button onClick={handleSubmit} disabled={saving} style={styles.saveBtn}>
          {saving ? 'Saving...' : 'Save Template'}
        </button>
        <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Template card (list item)
// ------------------------------------------------------------------

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: CardTemplate;
  onEdit: (t: CardTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const borderColor = template.color || 'var(--accent)';
  const buttonStyleColors: Record<string, string> = {
    primary: 'var(--accent)',
    secondary: 'var(--bg-tertiary)',
    danger: 'var(--danger)',
  };

  return (
    <div style={{ ...styles.templateCard, borderLeftColor: borderColor }}>
      <div style={styles.templateHeader}>
        <button onClick={() => setExpanded((v) => !v)} style={styles.expandBtn}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <div style={styles.templateInfo}>
          <span style={styles.templateName}>{template.name}</span>
          <span style={styles.templateTitle}>{template.titleTemplate}</span>
          <div style={styles.templateMeta}>
            {template.fields && template.fields.length > 0 && (
              <span style={styles.metaBadge}>{template.fields.length} field{template.fields.length !== 1 ? 's' : ''}</span>
            )}
            {template.buttons && template.buttons.length > 0 && (
              <span style={styles.metaBadge}>{template.buttons.length} button{template.buttons.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <div style={styles.cardActions}>
          <button onClick={() => onEdit(template)} style={styles.iconBtn} title="Edit">
            <Pencil size={15} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button onClick={() => onDelete(template.id)} style={styles.iconBtn} title="Delete">
            <Trash2 size={15} style={{ color: 'var(--danger)' }} />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={styles.expandedContent}>
          {template.bodyTemplate && (
            <div style={styles.previewBody}>{template.bodyTemplate}</div>
          )}

          {template.fields && template.fields.length > 0 && (
            <div style={styles.expandedSection}>
              <div style={styles.expandedLabel}>Fields</div>
              <div style={styles.fieldGrid}>
                {template.fields.map((f, i) => (
                  <div key={i} style={styles.fieldChip}>
                    <span style={styles.fieldKey}>{f.key}</span>
                    <span style={styles.fieldLabel}>{f.label}</span>
                    <span style={styles.typeBadge}>{f.type}</span>
                    {f.type === 'select' && f.options && f.options.length > 0 && (
                      <span style={styles.fieldMeta}>{f.options.join(', ')}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {template.buttons && template.buttons.length > 0 && (
            <div style={styles.expandedSection}>
              <div style={styles.expandedLabel}>Buttons</div>
              <div style={styles.buttonPreviewRow}>
                {template.buttons.map((b, i) => (
                  <span
                    key={i}
                    style={{
                      ...styles.buttonPreview,
                      background: buttonStyleColors[b.style] || 'var(--accent)',
                      color: b.style === 'secondary' ? 'var(--text-primary)' : 'white',
                    }}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Main component
// ------------------------------------------------------------------

export function CardTemplateManager({ spaceId }: Props) {
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<CardTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    try {
      const data = await api<CardTemplate[]>(`/spaces/${spaceId}/workflows/card-templates`);
      setTemplates(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, [spaceId]);

  const handleCreate = async (form: FormState) => {
    setSaving(true);
    try {
      await api(`/spaces/${spaceId}/workflows/card-templates`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          titleTemplate: form.titleTemplate.trim(),
          bodyTemplate: form.bodyTemplate.trim() || null,
          color: form.color || null,
          fields: form.fields.length > 0 ? form.fields : null,
          buttons: form.buttons.length > 0 ? form.buttons : null,
        }),
      });
      setShowForm(false);
      fetchTemplates();
    } catch (err: any) {
      alert(err?.message || 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (form: FormState) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await api(`/spaces/${spaceId}/workflows/card-templates/${editTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name.trim(),
          titleTemplate: form.titleTemplate.trim(),
          bodyTemplate: form.bodyTemplate.trim() || null,
          color: form.color || null,
          fields: form.fields.length > 0 ? form.fields : null,
          buttons: form.buttons.length > 0 ? form.buttons : null,
        }),
      });
      setEditTarget(null);
      fetchTemplates();
    } catch (err: any) {
      alert(err?.message || 'Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this card template? Cards already posted will still display but cannot be edited.')) return;
    try {
      await api(`/spaces/${spaceId}/workflows/card-templates/${id}`, { method: 'DELETE' });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err?.message || 'Failed to delete template');
    }
  };

  const openEdit = (template: CardTemplate) => {
    setShowForm(false);
    setEditTarget(template);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditTarget(null);
  };

  return (
    <div>
      <div style={styles.topBar}>
        <p style={styles.description}>
          Card templates define the structure of interactive cards that workflows can post to channels. Use {'{{variable}}'} in title and body templates to insert dynamic content.
        </p>
        {!showForm && !editTarget && (
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>
            <Plus size={16} /> New Template
          </button>
        )}
      </div>

      {showForm && (
        <CardForm onSave={handleCreate} onCancel={cancelForm} saving={saving} />
      )}

      {loading && <div style={styles.empty}>Loading templates...</div>}

      {!loading && templates.length === 0 && !showForm && (
        <div style={styles.empty}>No card templates yet. Create one to use in workflow actions.</div>
      )}

      {templates.map((t) =>
        editTarget?.id === t.id ? (
          <CardForm
            key={t.id}
            initial={templateFromCard(t)}
            onSave={handleEdit}
            onCancel={cancelForm}
            saving={saving}
          />
        ) : (
          <TemplateCard key={t.id} template={t} onEdit={openEdit} onDelete={handleDelete} />
        )
      )}
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
  templateCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderLeft: '4px solid var(--accent)',
    borderRadius: 'var(--radius)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  templateHeader: {
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
  templateInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    minWidth: 0,
  },
  templateName: {
    fontWeight: 700,
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
  },
  templateTitle: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    fontFamily: 'monospace',
  },
  templateMeta: {
    display: 'flex',
    gap: 6,
    marginTop: 2,
  },
  metaBadge: {
    fontSize: '0.68rem',
    fontWeight: 600,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
    padding: '1px 7px',
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
  expandedContent: {
    borderTop: '1px solid var(--border)',
    padding: '10px 14px',
    background: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  previewBody: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'pre-wrap' as const,
    fontFamily: 'monospace',
    background: 'var(--bg-tertiary)',
    padding: '8px',
    borderRadius: 'var(--radius)',
  },
  expandedSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  expandedLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
  },
  fieldGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  fieldChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.8rem',
    padding: '4px 8px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
  },
  fieldKey: {
    fontFamily: 'monospace',
    fontSize: '0.78rem',
    color: 'var(--accent)',
    flex: '0 0 auto',
  },
  fieldLabel: {
    color: 'var(--text-secondary)',
    flex: 1,
  },
  fieldMeta: {
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontStyle: 'italic',
  },
  typeBadge: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
    padding: '1px 6px',
    borderRadius: 4,
    fontSize: '0.72rem',
    fontWeight: 500,
  },
  buttonPreviewRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  buttonPreview: {
    padding: '4px 12px',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'default',
  },
  // Form
  formCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius)',
    padding: '16px',
    marginBottom: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  formRow: {
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
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
  },
  hint: {
    fontSize: '0.7rem',
    fontWeight: 400,
    color: 'var(--text-muted)',
    textTransform: 'none' as const,
    marginLeft: 6,
    fontStyle: 'italic',
  },
  colorRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  colorPicker: {
    width: 36,
    height: 34,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    padding: 2,
    background: 'var(--bg-primary)',
    flexShrink: 0,
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
  sectionWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  emptyHint: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    padding: '6px 4px',
  },
  subRow: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  subRowHeader: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  optionsArea: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    paddingTop: 4,
    borderTop: '1px solid var(--border)',
  },
  optionChips: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
    minHeight: 24,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px 2px 10px',
    background: 'var(--accent)',
    color: 'white',
    borderRadius: 12,
    fontSize: '0.78rem',
    fontWeight: 500,
  },
  chipRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.8)',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
  },
  optionAddRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  error: {
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
