import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import type { RouteCategory } from '@crabac/shared';

interface Props {
  spaceId: string;
  categories: RouteCategory[];
  onCategoriesChange: (categories: RouteCategory[]) => void;
}

export function RouteCategoryManager({ spaceId, categories, onCategoriesChange }: Props) {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setError('');
    try {
      const cat = await api<RouteCategory>(`/spaces/${spaceId}/route-categories`, {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      });
      onCategoriesChange([...categories, cat]);
      setNewName('');
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/spaces/${spaceId}/route-categories/${id}`, { method: 'DELETE' });
      onCategoriesChange(categories.filter((c) => c.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div style={styles.container}>
      {error && <div style={styles.error}>{error}</div>}
      <div style={styles.list}>
        {categories.map((cat) => (
          <div key={cat.id} style={styles.item}>
            <span style={styles.name}>{cat.name}</span>
            <button onClick={() => handleDelete(cat.id)} style={styles.deleteBtn} title="Delete category">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <div style={styles.addRow}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          style={styles.input}
          maxLength={100}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button onClick={handleAdd} disabled={!newName.trim()} style={styles.addBtn}>
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' },
  error: { background: 'rgba(237, 66, 69, 0.15)', color: 'var(--danger)', padding: '4px 8px', borderRadius: 'var(--radius)', fontSize: '0.8rem', marginBottom: 6 },
  list: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  item: { display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'var(--bg-tertiary)', borderRadius: 12, fontSize: '0.8rem' },
  name: { color: 'var(--text-primary)' },
  deleteBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' },
  addRow: { display: 'flex', gap: 6 },
  input: { flex: 1, padding: '5px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' },
  addBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
};
