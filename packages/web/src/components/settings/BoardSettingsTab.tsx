import { useState, useEffect } from 'react';
import { ExternalLink, RotateCw, Plus, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useSpacesStore } from '../../stores/spaces.js';
import { PUBLIC_THEMES } from '../../lib/publicThemes.js';
import type { SpaceAdminSettings } from '@crabac/shared';

interface Props {
  spaceId: string;
}

export function BoardSettingsTab({ spaceId }: Props) {
  const [settings, setSettings] = useState<SpaceAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings`)
      .then((s) => { setSettings(s); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [spaceId]);

  const [rotatingSecret, setRotatingSecret] = useState(false);

  const handleRotateSecret = async () => {
    if (!confirm('Are you sure? Rotating the secret will invalidate all existing webhook URLs.')) return;
    setRotatingSecret(true);
    setError('');
    try {
      const updated = await api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings/rotate-webhook-secret`, {
        method: 'POST',
      });
      setSettings(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to rotate secret');
    } finally {
      setRotatingSecret(false);
    }
  };

  const handleThemeChange = async (themeId: string | null) => {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings`, {
        method: 'PUT',
        body: JSON.stringify({ publicTheme: themeId }),
      });
      setSettings(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update theme');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (key: 'allowPublicBoards' | 'allowPublicGalleries' | 'allowPublicCalendar' | 'allowPublicRoutes' | 'allowPublicBlog' | 'allowPublicNewsletter' | 'allowPublicNewsletterSubscription' | 'allowAnonymousBrowsing' | 'webhooksEnabled') => {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings`, {
        method: 'PUT',
        body: JSON.stringify({ [key]: !settings[key] }),
      });
      setSettings(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const space = useSpacesStore((s) => s.spaces.find((sp) => sp.id === spaceId));

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading...</div>;

  const boardUrl = `${window.location.origin}/boards/${space?.slug || spaceId}`;
  const galleryUrl = `${window.location.origin}/gallery/${space?.slug || spaceId}`;
  const routesUrl = `${window.location.origin}/routes/${space?.slug || spaceId}`;
  const calendarUrl = `${window.location.origin}/calendar/${space?.slug || spaceId}`;
  const blogUrl = `${window.location.origin}/blog/${space?.slug || spaceId}`;
  const newsletterUrl = `${window.location.origin}/newsletter/${space?.slug || spaceId}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error && <div style={styles.error}>{error}</div>}

      {/* Public Page Theme */}
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <span style={styles.settingLabel}>Public Page Theme</span>
        <span style={{ ...styles.settingDesc, display: 'block', marginBottom: 10 }}>
          Choose the visual theme for all public pages (boards, gallery, routes, calendar, blog).
        </span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PUBLIC_THEMES.map((t) => {
            const isSelected = (settings?.publicTheme || 'modern') === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id === 'modern' ? null : t.id)}
                disabled={saving}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '12px 16px',
                  background: 'var(--bg-secondary)',
                  border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  minWidth: 160,
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: t.colors.pageBg, border: '1px solid #ccc' }} />
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: t.colors.accent }} />
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: t.colors.headingColor }} />
                  </div>
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Enable Public Boards</span>
          <span style={styles.settingDesc}>
            Allow forum channels to be marked as public and accessible without a space membership.
          </span>
        </div>
        <button
          onClick={() => handleToggle('allowPublicBoards')}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.allowPublicBoards ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.allowPublicBoards ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Enable Public Galleries</span>
          <span style={styles.settingDesc}>
            Allow media gallery channels to be marked as public and viewable without a space membership.
          </span>
        </div>
        <button
          onClick={() => handleToggle('allowPublicGalleries')}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.allowPublicGalleries ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.allowPublicGalleries ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Enable Public Routes</span>
          <span style={styles.settingDesc}>
            Allow route library channels to be marked as public and browsable without a space membership.
          </span>
        </div>
        <button
          onClick={() => handleToggle('allowPublicRoutes')}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.allowPublicRoutes ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.allowPublicRoutes ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Enable Public Calendar</span>
          <span style={styles.settingDesc}>
            Allow the community calendar to be viewed publicly via a dedicated web page.
          </span>
        </div>
        <button
          onClick={() => handleToggle('allowPublicCalendar')}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.allowPublicCalendar ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.allowPublicCalendar ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Enable Public Blog</span>
          <span style={styles.settingDesc}>
            Allow published blog posts marked as public to be viewable on a dedicated web page.
          </span>
        </div>
        <button
          onClick={() => handleToggle('allowPublicBlog')}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.allowPublicBlog ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.allowPublicBlog ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Allow Anonymous Browsing</span>
          <span style={styles.settingDesc}>
            Let visitors browse public boards, galleries, and calendar without logging in. Posting still requires authentication.
          </span>
        </div>
        <button
          onClick={() => handleToggle('allowAnonymousBrowsing')}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.allowAnonymousBrowsing ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.allowAnonymousBrowsing ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Enable Webhooks</span>
          <span style={styles.settingDesc}>
            Allow external services to trigger workflows via HTTP requests, and workflows to call external URLs.
          </span>
        </div>
        <button
          onClick={() => handleToggle('webhooksEnabled')}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.webhooksEnabled ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.webhooksEnabled ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      {settings?.webhooksEnabled && settings?.webhookSecret && (
        <div style={styles.urlBox}>
          <span style={styles.settingLabel}>Webhook Base URL</span>
          <code style={styles.urlCode}>
            {window.location.origin}/api/webhooks/{settings.webhookSecret}/
          </code>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleRotateSecret}
              disabled={rotatingSecret}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <RotateCw size={12} />
              {rotatingSecret ? 'Rotating...' : 'Rotate Secret'}
            </button>
          </div>
          <span style={styles.settingDesc}>
            Append your webhook slug to this URL. Configure slugs in Workflow trigger settings.
          </span>
        </div>
      )}

      {settings?.allowPublicBoards && (
        <div style={styles.urlBox}>
          <span style={styles.settingLabel}>Public Board URL</span>
          <a
            href={boardUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.urlLink}
          >
            <code style={styles.urlCode}>{boardUrl}</code>
            <ExternalLink size={14} style={{ flexShrink: 0 }} />
          </a>
          <span style={styles.settingDesc}>
            Mark individual forum channels as public in the Channels tab.
          </span>
        </div>
      )}

      {settings?.allowPublicGalleries && (
        <div style={styles.urlBox}>
          <span style={styles.settingLabel}>Public Gallery URL</span>
          <a
            href={galleryUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.urlLink}
          >
            <code style={styles.urlCode}>{galleryUrl}</code>
            <ExternalLink size={14} style={{ flexShrink: 0 }} />
          </a>
          <span style={styles.settingDesc}>
            Mark individual media gallery channels as public in the Channels tab.
          </span>
        </div>
      )}

      {settings?.allowPublicRoutes && (
        <div style={styles.urlBox}>
          <span style={styles.settingLabel}>Public Routes URL</span>
          <a
            href={routesUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.urlLink}
          >
            <code style={styles.urlCode}>{routesUrl}</code>
            <ExternalLink size={14} style={{ flexShrink: 0 }} />
          </a>
          <span style={styles.settingDesc}>
            Mark individual route library channels as public in the Channels tab.
          </span>
        </div>
      )}

      {settings?.allowPublicCalendar && (
        <div style={styles.urlBox}>
          <span style={styles.settingLabel}>Public Calendar URL</span>
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.urlLink}
          >
            <code style={styles.urlCode}>{calendarUrl}</code>
            <ExternalLink size={14} style={{ flexShrink: 0 }} />
          </a>
          <span style={styles.settingDesc}>
            Mark individual events as public when creating or editing them.
          </span>
        </div>
      )}

      {settings?.allowPublicBlog && (
        <div style={styles.urlBox}>
          <span style={styles.settingLabel}>Public Blog URL</span>
          <a
            href={blogUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.urlLink}
          >
            <code style={styles.urlCode}>{blogUrl}</code>
            <ExternalLink size={14} style={{ flexShrink: 0 }} />
          </a>
          <span style={styles.settingDesc}>
            Mark individual posts as public when creating or editing them.
          </span>
        </div>
      )}

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Enable Public Newsletter</span>
          <span style={styles.settingDesc}>
            Allow published newsletters marked as public to be viewable on a dedicated web page.
          </span>
        </div>
        <button
          onClick={() => handleToggle('allowPublicNewsletter')}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.allowPublicNewsletter ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.allowPublicNewsletter ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <span style={styles.settingLabel}>Allow Public Newsletter Subscription</span>
          <span style={styles.settingDesc}>
            Allow anonymous visitors to subscribe to newsletters via email on the public page.
          </span>
        </div>
        <button
          onClick={() => handleToggle('allowPublicNewsletterSubscription')}
          disabled={saving}
          style={{
            ...styles.toggle,
            background: settings?.allowPublicNewsletterSubscription ? 'var(--accent)' : 'var(--bg-tertiary)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            transform: settings?.allowPublicNewsletterSubscription ? 'translateX(18px)' : 'translateX(0)',
          }} />
        </button>
      </div>

      {settings?.allowPublicNewsletter && (
        <div style={styles.urlBox}>
          <span style={styles.settingLabel}>Public Newsletter URL</span>
          <a
            href={newsletterUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.urlLink}
          >
            <code style={styles.urlCode}>{newsletterUrl}</code>
            <ExternalLink size={14} style={{ flexShrink: 0 }} />
          </a>
          <span style={styles.settingDesc}>
            Mark individual newsletters as public when creating or editing them.
          </span>
        </div>
      )}

      {/* Navbar Feature Toggles */}
      <NavbarFeaturesSection
        spaceId={spaceId}
        settings={settings}
        saving={saving}
        onUpdate={(disabledFeatures) => setSettings(s => s ? { ...s, publicNavDisabledFeatures: disabledFeatures } : s)}
        onError={setError}
      />

      {/* Custom Navigation Links */}
      <CustomNavLinksSection
        spaceId={spaceId}
        links={settings?.publicNavLinks || []}
        saving={saving}
        onUpdate={(links) => setSettings(s => s ? { ...s, publicNavLinks: links } : s)}
        onError={setError}
      />
    </div>
  );
}

const ALL_NAV_FEATURES = [
  { key: 'boards', label: 'Boards', settingsKey: 'allowPublicBoards' },
  { key: 'gallery', label: 'Gallery', settingsKey: 'allowPublicGalleries' },
  { key: 'routes', label: 'Routes', settingsKey: 'allowPublicRoutes' },
  { key: 'calendar', label: 'Calendar', settingsKey: 'allowPublicCalendar' },
  { key: 'blog', label: 'Blog', settingsKey: 'allowPublicBlog' },
  { key: 'newsletter', label: 'Newsletter', settingsKey: 'allowPublicNewsletter' },
] as const;

function NavbarFeaturesSection({
  spaceId,
  settings,
  saving: parentSaving,
  onUpdate,
  onError,
}: {
  spaceId: string;
  settings: SpaceAdminSettings | null;
  saving: boolean;
  onUpdate: (disabledFeatures: string[]) => void;
  onError: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  if (!settings) return null;

  const enabledFeatures = ALL_NAV_FEATURES.filter(
    (f) => settings[f.settingsKey as keyof SpaceAdminSettings],
  );

  if (enabledFeatures.length === 0) return null;

  const disabled = settings.publicNavDisabledFeatures || [];

  const handleToggle = async (featureKey: string) => {
    const isCurrentlyDisabled = disabled.includes(featureKey);
    const updated = isCurrentlyDisabled
      ? disabled.filter((f) => f !== featureKey)
      : [...disabled, featureKey];

    setSaving(true);
    onError('');
    try {
      const result = await api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings`, {
        method: 'PUT',
        body: JSON.stringify({ publicNavDisabledFeatures: updated }),
      });
      onUpdate(result.publicNavDisabledFeatures || []);
    } catch (err: any) {
      onError(err.message || 'Failed to update navbar settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <span style={styles.settingLabel}>Navigation Bar</span>
      <span style={{ ...styles.settingDesc, display: 'block', marginBottom: 12 }}>
        Choose which public features appear in the cross-page navigation bar. The navbar is shown when more than one feature is visible or custom links exist.
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {enabledFeatures.map((f) => {
          const isShown = !disabled.includes(f.key);
          return (
            <div key={f.key} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)',
            }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{f.label}</span>
              <button
                onClick={() => handleToggle(f.key)}
                disabled={saving}
                style={{
                  ...styles.toggle,
                  background: isShown ? 'var(--accent)' : 'var(--bg-tertiary)',
                  width: 36,
                  height: 20,
                }}
              >
                <div style={{
                  ...styles.toggleKnob,
                  width: 16,
                  height: 16,
                  transform: isShown ? 'translateX(16px)' : 'translateX(0)',
                }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomNavLinksSection({
  spaceId,
  links,
  saving: parentSaving,
  onUpdate,
  onError,
}: {
  spaceId: string;
  links: { label: string; url: string }[];
  saving: boolean;
  onUpdate: (links: { label: string; url: string }[]) => void;
  onError: (msg: string) => void;
}) {
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const saveLinks = async (updated: { label: string; url: string }[]) => {
    setSaving(true);
    onError('');
    try {
      const result = await api<SpaceAdminSettings>(`/spaces/${spaceId}/admin-settings`, {
        method: 'PUT',
        body: JSON.stringify({ publicNavLinks: updated }),
      });
      onUpdate(result.publicNavLinks || []);
    } catch (err: any) {
      onError(err.message || 'Failed to update navigation links');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const label = newLabel.trim();
    const url = newUrl.trim();
    if (!label || !url) return;
    try { new URL(url); } catch { onError('Please enter a valid URL'); return; }
    if (links.length >= 20) { onError('Maximum 20 custom links allowed'); return; }
    const updated = [...links, { label, url }];
    saveLinks(updated);
    setNewLabel('');
    setNewUrl('');
  };

  const handleRemove = (index: number) => {
    saveLinks(links.filter((_, i) => i !== index));
  };

  return (
    <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <span style={styles.settingLabel}>Custom Navigation Links</span>
      <span style={{ ...styles.settingDesc, display: 'block', marginBottom: 12 }}>
        Add external links to the navigation bar on all public pages. These open in a new tab.
      </span>

      {links.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {links.map((link, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)',
            }}>
              <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                {link.label}
              </span>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.8rem', color: 'var(--accent)', textDecoration: 'none', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {link.url}
              </a>
              <button
                onClick={() => handleRemove(i)}
                disabled={saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  borderRadius: 4,
                  flexShrink: 0,
                }}
                title="Remove link"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '0 0 160px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Label</label>
          <input
            type="text"
            placeholder="Our Website"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            maxLength={100}
            style={{
              padding: '6px 10px',
              fontSize: '0.85rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>URL</label>
          <input
            type="url"
            placeholder="https://example.com"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            maxLength={500}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            style={{
              padding: '6px 10px',
              fontSize: '0.85rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={saving || !newLabel.trim() || !newUrl.trim() || links.length >= 20}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 14px',
            fontSize: '0.85rem',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            opacity: saving || !newLabel.trim() || !newUrl.trim() ? 0.5 : 1,
          }}
        >
          <Plus size={14} />
          Add
        </button>
      </div>
      {links.length >= 20 && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
          Maximum 20 links reached
        </span>
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
  urlBox: {
    padding: '12px 16px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  urlLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--accent)',
    textDecoration: 'none',
  },
  urlCode: {
    padding: '6px 10px',
    background: 'var(--bg-input)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    color: 'var(--accent)',
    fontFamily: 'monospace',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
};
