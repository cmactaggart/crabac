import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useCalendarStore } from '../../stores/calendar.js';
import { useSpacesStore } from '../../stores/spaces.js';
import type { SpaceAdminSettings, CalendarCategory } from '@crabac/shared';

interface Props {
  spaceId: string;
}

const PRESET_COLORS = [
  '#5865f2', '#57f287', '#fee75c', '#eb459e',
  '#ed4245', '#f47b67', '#3ba55d', '#9b59b6',
];

export function CalendarSettingsTab({ spaceId }: Props) {
  const [settings, setSettings] = useState<SpaceAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fetchSpaces = useSpacesStore((s) => s.fetchSpaces);

  const categories = useCalendarStore((s) => s.categories);
  const fetchCategories = useCalendarStore((s) => s.fetchCategories);
  const createCategory = useCalendarStore((s) => s.createCategory);
  const updateCategory = useCalendarStore((s) => s.updateCategory);
  const deleteCategory = useCalendarStore((s) => s.deleteCategory);

  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColor, setEditCatColor] = useState('');

  useEffect(() => {
    api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings`)
      .then((s) => { setSettings(s); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
    fetchCategories(spaceId);
  }, [spaceId, fetchCategories]);

  const handleToggle = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings`, {
        method: 'PUT',
        body: JSON.stringify({ calendarEnabled: !settings.calendarEnabled }),
      });
      setSettings(updated);
      // Refresh spaces so sidebar picks up the change
      fetchSpaces();
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setError('');
    try {
      await createCategory(spaceId, { name: newCatName.trim(), color: newCatColor });
      setNewCatName('');
      setNewCatColor(PRESET_COLORS[0]);
      setShowAddCat(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
    }
  };

  const handleSaveCategory = async (id: string) => {
    if (!editCatName.trim()) return;
    setError('');
    try {
      await updateCategory(spaceId, id, { name: editCatName.trim(), color: editCatColor });
      setEditCatId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Delete this category? Events using it will become uncategorized.')) return;
    setError('');
    try {
      await deleteCategory(spaceId, id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete category');
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Enable Community Calendar</span>
          <span style={styles.settingDesc}>
            Show a calendar in the channel sidebar. Members can view events; those with Manage Calendar permission can create them.
          </span>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.calendarEnabled ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.calendarEnabled ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      {settings?.calendarEnabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={styles.settingLabel}>Event Categories</span>
            <button
              onClick={() => setShowAddCat(!showAddCat)}
              style={styles.addBtn}
            >
              + Add Category
            </button>
          </div>

          {showAddCat && (
            <div style={styles.catForm}>
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category name"
                style={styles.input}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              />
              <div style={styles.colorRow}>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewCatColor(c)}
                    style={{
                      ...styles.colorDot,
                      background: c,
                      outline: newCatColor === c ? '2px solid var(--text-primary)' : 'none',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAddCat(false)} style={styles.cancelBtn}>Cancel</button>
                <button onClick={handleAddCategory} disabled={!newCatName.trim()} style={styles.saveBtn}>Create</button>
              </div>
            </div>
          )}

          {categories.length === 0 && !showAddCat && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No categories yet. Categories let you color-code events.
            </p>
          )}

          {categories.map((cat) => (
            <div key={cat.id} style={styles.catRow}>
              {editCatId === cat.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <input
                    value={editCatName}
                    onChange={(e) => setEditCatName(e.target.value)}
                    style={styles.input}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveCategory(cat.id)}
                  />
                  <div style={styles.colorRow}>
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditCatColor(c)}
                        style={{
                          ...styles.colorDot,
                          background: c,
                          outline: editCatColor === c ? '2px solid var(--text-primary)' : 'none',
                          outlineOffset: 2,
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditCatId(null)} style={styles.cancelBtn}>Cancel</button>
                    <button onClick={() => handleSaveCategory(cat.id)} style={styles.saveBtn}>Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <span style={{ ...styles.colorDotSmall, background: cat.color }} />
                  <span
                    style={{ flex: 1, fontSize: '0.9rem', cursor: 'pointer' }}
                    onClick={() => {
                      setEditCatId(cat.id);
                      setEditCatName(cat.name);
                      setEditCatColor(cat.color);
                    }}
                  >
                    {cat.name}
                  </span>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    style={styles.trashBtn}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '12px 0',
    borderBottom: '1px solid var(--border)',
  },
  settingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
  },
  settingLabel: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  settingDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    padding: 2,
    flexShrink: 0,
    transition: 'background 0.2s',
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: '#fff',
    transition: 'transform 0.2s',
  },
  addBtn: {
    padding: '6px 12px',
    background: 'var(--bg-tertiary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  catForm: {
    padding: '12px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  catRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
  },
  input: {
    padding: '6px 10px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  colorRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
  },
  colorDotSmall: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    flexShrink: 0,
  },
  cancelBtn: {
    padding: '6px 12px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  saveBtn: {
    padding: '6px 12px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  trashBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 'var(--radius)',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
};
