import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useSpacesStore } from '../../stores/spaces.js';
import type { SpaceAdminSettings, SpaceTag } from '@crabac/shared';

interface Props {
  spaceId: string;
}

interface PredefinedTag {
  name: string;
  slug: string;
}

export function VisibilityTab({ spaceId }: Props) {
  const [settings, setSettings] = useState<SpaceAdminSettings | null>(null);
  const [tags, setTags] = useState<SpaceTag[]>([]);
  const [predefinedTags, setPredefinedTags] = useState<PredefinedTag[]>([]);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const fetchSpaces = useSpacesStore((s) => s.fetchSpaces);

  useEffect(() => {
    api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings`).then(setSettings).catch(() => {});
    api<SpaceTag[]>(`/spaces/${spaceId}/tags`).then(setTags).catch(() => {});
    api<{ predefined: PredefinedTag[] }>('/spaces/directory/tags')
      .then((d) => setPredefinedTags(d.predefined))
      .catch(() => {});
  }, [spaceId]);

  const updateSetting = async (key: string, value: boolean) => {
    setSaving(true);
    try {
      const updated = await api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings`, {
        method: 'PUT',
        body: JSON.stringify({ [key]: value }),
      });
      setSettings(updated);
      fetchSpaces();
    } catch {
      // ignore
    }
    setSaving(false);
  };

  const updateTags = async (newTags: string[]) => {
    try {
      const result = await api<SpaceTag[]>(`/spaces/${spaceId}/tags`, {
        method: 'PUT',
        body: JSON.stringify({ tags: newTags }),
      });
      setTags(result);
    } catch {
      // ignore
    }
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (!tag) return;
    const currentTags = tags.map((t) => t.tag);
    if (currentTags.includes(tag)) return;
    if (currentTags.length >= 10) return;
    updateTags([...currentTags, tag]);
    setNewTag('');
  };

  const removeTag = (tagSlug: string) => {
    const remaining = tags.filter((t) => t.tagSlug !== tagSlug).map((t) => t.tag);
    updateTags(remaining);
  };

  const togglePredefinedTag = (pt: PredefinedTag) => {
    const currentTags = tags.map((t) => t.tag);
    if (tags.some((t) => t.tagSlug === pt.slug)) {
      removeTag(pt.slug);
    } else {
      if (currentTags.length >= 10) return;
      updateTags([...currentTags, pt.name]);
    }
  };

  if (!settings) return <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Public Toggle */}
      <div>
        <div style={styles.settingRow}>
          <div>
            <div style={styles.settingLabel}>Make space public</div>
            <div style={styles.settingDesc}>
              Anyone can discover and browse this space without an invite.
              A "Guest" role will be created automatically with view-only permissions.
            </div>
          </div>
          <label style={styles.toggle}>
            <input
              type="checkbox"
              checked={settings.isPublic}
              onChange={(e) => updateSetting('isPublic', e.target.checked)}
              disabled={saving}
              style={styles.checkbox}
            />
            <span style={{
              ...styles.toggleTrack,
              background: settings.isPublic ? 'var(--accent)' : 'var(--bg-input)',
            }}>
              <span style={{
                ...styles.toggleThumb,
                transform: settings.isPublic ? 'translateX(18px)' : 'translateX(0)',
              }} />
            </span>
          </label>
        </div>
      </div>

      {/* Require Verified Email (shown when public) */}
      {settings.isPublic && (
        <div>
          <div style={styles.settingRow}>
            <div>
              <div style={styles.settingLabel}>Require verified email</div>
              <div style={styles.settingDesc}>
                Users must verify their email before they can browse or join this public space.
              </div>
            </div>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                checked={settings.requireVerifiedEmail}
                onChange={(e) => updateSetting('requireVerifiedEmail', e.target.checked)}
                disabled={saving}
                style={styles.checkbox}
              />
              <span style={{
                ...styles.toggleTrack,
                background: settings.requireVerifiedEmail ? 'var(--accent)' : 'var(--bg-input)',
              }}>
                <span style={{
                  ...styles.toggleThumb,
                  transform: settings.requireVerifiedEmail ? 'translateX(18px)' : 'translateX(0)',
                }} />
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Tags Section (shown when public) */}
      {settings.isPublic && (
        <div>
          <div style={styles.settingLabel}>Space tags</div>
          <div style={styles.settingDesc}>
            Tags help people discover your space in the directory. Up to 10 tags.
          </div>

          {/* Predefined tags */}
          {predefinedTags.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Suggested</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {predefinedTags.map((pt) => {
                  const isSelected = tags.some((t) => t.tagSlug === pt.slug);
                  return (
                    <button
                      key={pt.slug}
                      onClick={() => togglePredefinedTag(pt)}
                      style={{
                        ...styles.tagChip,
                        background: isSelected ? 'var(--accent)' : 'var(--bg-input)',
                        color: isSelected ? 'white' : 'var(--text-secondary)',
                      }}
                    >
                      {pt.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Current tags */}
          {tags.length > 0 && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {tags.map((t) => (
                <span key={t.tagSlug} style={styles.tagDisplay}>
                  {t.tag}
                  <button onClick={() => removeTag(t.tagSlug)} style={styles.tagRemove}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Add custom tag */}
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="Add a custom tag..."
              maxLength={50}
              style={styles.input}
            />
            <button onClick={addTag} style={styles.addBtn} disabled={!newTag.trim() || tags.length >= 10}>
              Add
            </button>
          </div>
        </div>
      )}

      {/* Featured status (read-only for space admins) */}
      {settings.isPublic && settings.isFeatured && (
        <div style={styles.featuredBadge}>
          This space is featured in the public directory.
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  settingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  settingLabel: {
    fontWeight: 600,
    fontSize: '0.9rem',
    marginBottom: '0.2rem',
  },
  settingDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    maxWidth: 320,
  },
  toggle: {
    position: 'relative',
    cursor: 'pointer',
    flexShrink: 0,
  },
  checkbox: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
  },
  toggleTrack: {
    display: 'block',
    width: 40,
    height: 22,
    borderRadius: 11,
    transition: 'background 0.2s',
    position: 'relative',
  },
  toggleThumb: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: 'white',
    transition: 'transform 0.2s',
  },
  tagChip: {
    padding: '0.25rem 0.6rem',
    borderRadius: '12px',
    border: 'none',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tagDisplay: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.2rem 0.5rem',
    borderRadius: '12px',
    background: 'var(--accent)',
    color: 'white',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  tagRemove: {
    background: 'none',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    opacity: 0.8,
  },
  input: {
    flex: 1,
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  addBtn: {
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
  featuredBadge: {
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius)',
    background: 'rgba(87, 242, 135, 0.15)',
    color: '#57f287',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
};
