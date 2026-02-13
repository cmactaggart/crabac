import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Space } from '@crabac/shared';
import { useAuthStore } from '../../stores/auth.js';
import { useSpacesStore } from '../../stores/spaces.js';
import { Camera } from 'lucide-react';

interface Props {
  space: Space;
  onClose: () => void;
}

export function OverviewTab({ space, onClose }: Props) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateSpace = useSpacesStore((s) => s.updateSpace);
  const uploadSpaceIcon = useSpacesStore((s) => s.uploadSpaceIcon);
  const deleteSpace = useSpacesStore((s) => s.deleteSpace);

  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description || '');
  const [saving, setSaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const isOwner = user?.id === space.ownerId;
  const hasChanges = name !== space.name || description !== (space.description || '');

  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIcon(true);
    setError('');
    try {
      await uploadSpaceIcon(space.id, file);
    } catch (err: any) {
      setError(err.message || 'Failed to upload icon');
    } finally {
      setUploadingIcon(false);
      if (iconInputRef.current) iconInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      await updateSpace(space.id, { name: name.trim(), description: description.trim() || undefined });
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSpace(space.id);
      onClose();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.field}>
        <label style={styles.label}>Space Icon</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.iconPreview}>
            {space.iconUrl ? (
              <img src={space.iconUrl} alt={space.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>{space.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <input
            ref={iconInputRef}
            type="file"
            accept="image/*"
            onChange={handleIconChange}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => iconInputRef.current?.click()}
            disabled={uploadingIcon}
            style={styles.cancelBtn}
          >
            <Camera size={14} style={{ marginRight: 6 }} />
            {uploadingIcon ? 'Uploading...' : 'Change Icon'}
          </button>
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Space Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
          maxLength={100}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
          maxLength={500}
        />
      </div>

      {hasChanges && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => { setName(space.name); setDescription(space.description || ''); }}
            style={styles.cancelBtn}
          >
            Reset
          </button>
          <button onClick={handleSave} disabled={!name.trim() || saving} style={styles.saveBtn}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {isOwner && (
        <div style={styles.dangerZone}>
          <h4 style={{ margin: '0 0 8px', color: 'var(--danger)' }}>Danger Zone</h4>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={styles.deleteBtn}>
              Delete Space
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Are you sure? This will permanently delete <strong>{space.name}</strong> and all its data.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmDelete(false)} style={styles.cancelBtn}>Cancel</button>
                <button onClick={handleDelete} disabled={deleting} style={styles.deleteBtn}>
                  {deleting ? 'Deleting...' : 'Yes, Delete Space'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  },
  input: {
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'inherit',
  },
  saveBtn: {
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    padding: '8px 20px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '8px 16px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  deleteBtn: {
    background: 'var(--danger)',
    border: 'none',
    color: 'white',
    padding: '8px 16px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  dangerZone: {
    marginTop: 16,
    padding: 16,
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius)',
  },
  iconPreview: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
};
