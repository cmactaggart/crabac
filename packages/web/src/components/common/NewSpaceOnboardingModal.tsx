import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Camera, Plus, Check, ChevronRight, ChevronDown } from 'lucide-react';
import { useSpacesStore } from '../../stores/spaces.js';
import { useChannelsStore } from '../../stores/channels.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { SpaceBrandedCard } from '../spaces/SpaceBrandedCard.js';
import { LetterIcon } from '../icons/LetterIcon.js';
import { api } from '../../lib/api.js';
import type { Space, Channel } from '@crabac/shared';

interface Props {
  onClose: () => void;
}

const TOTAL_STEPS = 9;

const SUGGESTED_CHANNELS = ['introductions', 'off-topic', 'help', 'links', 'announcements'];

const DEFAULT_WELCOME = 'Welcome to {space}, {{mention}}! We\'re glad to have you here.';

export function NewSpaceOnboardingModal({ onClose }: Props) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1: Name & Slug
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [space, setSpace] = useState<Space | null>(null);

  // Step 2: Avatar & Colors
  const [baseColor, setBaseColor] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [textColor, setTextColor] = useState('');
  const [showTextColor, setShowTextColor] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Discoverability
  const [isPublic, setIsPublic] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Step 4: Text Channels
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [customChannel, setCustomChannel] = useState('');

  // Step 5: Calendar
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [allowPublicCalendar, setAllowPublicCalendar] = useState(false);

  // Step 6: Blog
  const [blogEnabled, setBlogEnabled] = useState(false);
  const [allowPublicBlog, setAllowPublicBlog] = useState(false);

  // Step 7: Newsletter
  const [newsletterEnabled, setNewsletterEnabled] = useState(false);
  const [allowPublicNewsletter, setAllowPublicNewsletter] = useState(false);

  // Step 8: Specialty Channels
  const [galleryExpanded, setGalleryExpanded] = useState(false);
  const [forumExpanded, setForumExpanded] = useState(false);
  const [routeExpanded, setRouteExpanded] = useState(false);
  const [galleries, setGalleries] = useState<{ name: string; isPublic: boolean }[]>([]);
  const [forums, setForums] = useState<{ name: string; isPublic: boolean }[]>([]);
  const [routes, setRoutes] = useState<{ name: string; isPublic: boolean }[]>([]);
  const [newGalleryName, setNewGalleryName] = useState('');
  const [newGalleryPublic, setNewGalleryPublic] = useState(false);
  const [newForumName, setNewForumName] = useState('');
  const [newForumPublic, setNewForumPublic] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [newRoutePublic, setNewRoutePublic] = useState(false);

  // Step 8: Welcome Messages
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState(DEFAULT_WELCOME);

  // Track what the general channel ID is (created with space)
  const [generalChannelId, setGeneralChannelId] = useState<string | null>(null);

  // Summary tracking
  const [configuredFeatures, setConfiguredFeatures] = useState<string[]>([]);

  const createSpace = useSpacesStore((s) => s.createSpace);
  const uploadSpaceIcon = useSpacesStore((s) => s.uploadSpaceIcon);
  const fetchPublicTags = useSpacesStore((s) => s.fetchPublicTags);
  const publicTags = useSpacesStore((s) => s.publicTags);
  const fetchSpaces = useSpacesStore((s) => s.fetchSpaces);
  const createChannel = useChannelsStore((s) => s.createChannel);
  const updateChannel = useChannelsStore((s) => s.updateChannel);

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugEdited) {
      setSlug(name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    }
  }, [name, slugEdited]);

  // Fetch public tags when reaching step 3
  useEffect(() => {
    if (step === 3) {
      fetchPublicTags();
    }
  }, [step, fetchPublicTags]);

  const handleStep1 = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const s = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const created = await createSpace(name.trim(), s);
      setSpace(created);

      // Fetch channels to find the general channel
      const channels = await api<Channel[]>(`/spaces/${created.id}/channels`);
      const general = channels.find((ch) => ch.name === 'general');
      if (general) setGeneralChannelId(general.id);

      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to create space');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    if (!space) return;
    setLoading(true);
    setError('');
    try {
      if (baseColor || accentColor || (showTextColor && textColor)) {
        await api(`/spaces/${space.id}/admin-settings`, {
          method: 'PUT',
          body: JSON.stringify({
            baseColor: baseColor || null,
            accentColor: accentColor || null,
            textColor: (showTextColor && textColor) || null,
          }),
        });
        await fetchSpaces();
        addFeature('Branding colors');
      }
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to save colors');
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    if (!space) return;
    setLoading(true);
    setError('');
    try {
      await api(`/spaces/${space.id}/admin-settings`, {
        method: 'PUT',
        body: JSON.stringify({ isPublic }),
      });
      if (isPublic && selectedTags.length > 0) {
        await api(`/spaces/${space.id}/tags`, {
          method: 'PUT',
          body: JSON.stringify({ tags: selectedTags }),
        });
        addFeature('Public listing with tags');
      } else if (isPublic) {
        addFeature('Public listing');
      }
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleStep4 = async () => {
    if (!space) return;
    setLoading(true);
    setError('');
    try {
      const channelsToCreate = [...selectedChannels, ...(customChannel.trim() ? [customChannel.trim()] : [])];
      // Fetch existing channels to avoid duplicate creation on retry
      const existing = await api<Channel[]>(`/spaces/${space.id}/channels`);
      const existingNames = new Set(existing.map((ch) => ch.name));
      let created = 0;
      for (const ch of channelsToCreate) {
        if (!existingNames.has(ch)) {
          await createChannel(space.id, ch);
          created++;
        }
      }
      if (channelsToCreate.length > 0) {
        addFeature(`${channelsToCreate.length} additional channel${channelsToCreate.length > 1 ? 's' : ''}`);
      }
      setStep(5);
    } catch (err: any) {
      setError(err.message || 'Failed to create channels');
    } finally {
      setLoading(false);
    }
  };

  const handleStep5 = async () => {
    if (!space) return;
    setLoading(true);
    setError('');
    try {
      if (calendarEnabled) {
        await api(`/spaces/${space.id}/admin-settings`, {
          method: 'PUT',
          body: JSON.stringify({ calendarEnabled: true, allowPublicCalendar }),
        });
        addFeature('Community calendar');
      }
      setStep(6);
    } catch (err: any) {
      setError(err.message || 'Failed to save calendar settings');
    } finally {
      setLoading(false);
    }
  };

  const handleStep6 = async () => {
    if (!space) return;
    setLoading(true);
    setError('');
    try {
      if (blogEnabled) {
        await api(`/spaces/${space.id}/admin-settings`, {
          method: 'PUT',
          body: JSON.stringify({ blogEnabled: true, allowPublicBlog }),
        });
        addFeature('Community blog');
      }
      setStep(7);
    } catch (err: any) {
      setError(err.message || 'Failed to save blog settings');
    } finally {
      setLoading(false);
    }
  };

  const handleStep7 = async () => {
    if (!space) return;
    setLoading(true);
    setError('');
    try {
      if (newsletterEnabled) {
        await api(`/spaces/${space.id}/admin-settings`, {
          method: 'PUT',
          body: JSON.stringify({ newsletterEnabled: true, allowPublicNewsletter }),
        });
        addFeature('Newsletter');
      }
      setStep(8);
    } catch (err: any) {
      setError(err.message || 'Failed to save newsletter settings');
    } finally {
      setLoading(false);
    }
  };

  const handleStep8 = async () => {
    if (!space) return;
    setLoading(true);
    setError('');
    try {
      const adminUpdate: Record<string, boolean> = {};

      // Fetch existing channels to avoid duplicate creation on retry
      const existing = await api<Channel[]>(`/spaces/${space.id}/channels`);
      const existingNames = new Set(existing.map((ch) => ch.name));

      // Create galleries
      for (const g of galleries) {
        let ch = existing.find((c) => c.name === g.name && c.type === 'media_gallery');
        if (!ch) {
          ch = await createChannel(space.id, g.name, undefined, undefined, 'media_gallery');
        }
        if (g.isPublic && !ch.isPublic) {
          await updateChannel(space.id, ch.id, { isPublic: true });
          adminUpdate.allowPublicGalleries = true;
        } else if (g.isPublic) {
          adminUpdate.allowPublicGalleries = true;
        }
      }

      // Create forums
      for (const f of forums) {
        let ch = existing.find((c) => c.name === f.name && c.type === 'forum');
        if (!ch) {
          ch = await createChannel(space.id, f.name, undefined, undefined, 'forum');
        }
        if (f.isPublic && !ch.isPublic) {
          await updateChannel(space.id, ch.id, { isPublic: true });
          adminUpdate.allowPublicBoards = true;
        } else if (f.isPublic) {
          adminUpdate.allowPublicBoards = true;
        }
      }

      // Create routes
      for (const r of routes) {
        let ch = existing.find((c) => c.name === r.name && c.type === 'route_library');
        if (!ch) {
          ch = await createChannel(space.id, r.name, undefined, undefined, 'route_library');
        }
        if (r.isPublic && !ch.isPublic) {
          await updateChannel(space.id, ch.id, { isPublic: true });
          adminUpdate.allowPublicRoutes = true;
        } else if (r.isPublic) {
          adminUpdate.allowPublicRoutes = true;
        }
      }

      if (Object.keys(adminUpdate).length > 0) {
        await api(`/spaces/${space.id}/admin-settings`, {
          method: 'PUT',
          body: JSON.stringify(adminUpdate),
        });
      }

      if (galleries.length > 0) addFeature(`${galleries.length} gallery channel${galleries.length > 1 ? 's' : ''}`);
      if (forums.length > 0) addFeature(`${forums.length} forum channel${forums.length > 1 ? 's' : ''}`);
      if (routes.length > 0) addFeature(`${routes.length} route channel${routes.length > 1 ? 's' : ''}`);

      setStep(9);
    } catch (err: any) {
      setError(err.message || 'Failed to create specialty channels');
    } finally {
      setLoading(false);
    }
  };

  const handleStep9 = async () => {
    if (!space) return;
    setLoading(true);
    setError('');
    try {
      if (welcomeEnabled && generalChannelId) {
        await api(`/spaces/${space.id}/workflows`, {
          method: 'POST',
          body: JSON.stringify({
            name: 'Welcome New Members',
            triggerType: 'member_joined',
            triggerConfig: null,
            conditions: null,
            actions: [{
              type: 'send_message',
              config: {
                channelId: generalChannelId,
                content: welcomeMessage,
                messageStyle: 'system',
              },
            }],
          }),
        });
        addFeature('Welcome message workflow');
      }
      setStep(10); // Done screen
    } catch (err: any) {
      setError(err.message || 'Failed to create workflow');
    } finally {
      setLoading(false);
    }
  };

  const addFeature = (feature: string) => {
    setConfiguredFeatures((prev) => [...prev, feature]);
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !space) return;
    setUploadingIcon(true);
    setError('');
    try {
      await uploadSpaceIcon(space.id, file);
      // Update local space reference
      const spaces = useSpacesStore.getState().spaces;
      const updated = spaces.find((s) => s.id === space.id);
      if (updated) setSpace(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to upload icon');
    } finally {
      setUploadingIcon(false);
      if (iconInputRef.current) iconInputRef.current.value = '';
    }
  };

  const toggleChannel = (ch: string) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 10) return prev;
      return [...prev, tag];
    });
  };

  const handleNext = () => {
    setError('');
    switch (step) {
      case 1: handleStep1(); break;
      case 2: handleStep2(); break;
      case 3: handleStep3(); break;
      case 4: handleStep4(); break;
      case 5: handleStep5(); break;
      case 6: handleStep6(); break;
      case 7: handleStep7(); break;
      case 8: handleStep8(); break;
      case 9: handleStep9(); break;
    }
  };

  const handleSkip = () => {
    setError('');
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      setStep(9); // Done screen
    }
  };

  const handleGoToSpace = () => {
    if (space) {
      navigate(`/space/${space.id}`);
    }
    onClose();
  };

  const renderPublicUrl = (url: string) => (
    <div style={s.publicUrlBox}>
      <span style={s.publicUrlLabel}>You will be able to access this on the web at:</span>
      <span style={s.publicUrl}>{url}</span>
    </div>
  );

  const renderStepIndicator = () => (
    <div style={s.stepIndicator}>
      {step <= TOTAL_STEPS && (
        <>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Step {step} of {TOTAL_STEPS}
          </span>
          <div style={s.stepDots}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: i + 1 <= step ? 'var(--accent)' : 'var(--bg-input)',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      case 8: return renderStep8();
      case 9: return renderStep9();
      case 10: return renderDone();
      default: return null;
    }
  };

  const renderStep1 = () => (
    <div style={s.stepContent}>
      <h2 style={s.stepTitle}>Name Your Space</h2>
      <p style={s.stepDesc}>Choose a name and URL slug for your new community.</p>

      <div style={s.field}>
        <label style={s.label}>Space Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Community"
          style={s.input}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && handleNext()}
        />
      </div>

      <div style={s.field}>
        <label style={s.label}>URL Slug</label>
        <input
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }}
          placeholder="my-community"
          style={s.input}
        />
        <span style={s.hint}>app.crab.ac/space/{slug || 'my-community'}</span>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div style={s.stepContent}>
      <h2 style={s.stepTitle}>Avatar & Colors</h2>
      <p style={s.stepDesc}>Give your space a visual identity.</p>

      {/* Avatar */}
      <div style={s.field}>
        <label style={s.label}>Space Icon</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={s.iconPreview}>
            {space?.iconUrl ? (
              <img src={space.iconUrl} alt={space.name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <LetterIcon letter={(space?.name || name).charAt(0)} size={56} />
            )}
          </div>
          <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconUpload} style={{ display: 'none' }} />
          <button onClick={() => iconInputRef.current?.click()} disabled={uploadingIcon} style={s.outlineBtn}>
            <Camera size={14} style={{ marginRight: 6 }} />
            {uploadingIcon ? 'Uploading...' : 'Upload Icon'}
          </button>
        </div>
      </div>

      {/* Colors */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={s.label}>Base Color</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ ...s.colorSwatch, background: baseColor || '#4a2a6a' }}>
              <input
                type="color"
                value={baseColor || '#4a2a6a'}
                onChange={(e) => setBaseColor(e.target.value)}
                style={s.colorHiddenInput}
              />
            </label>
            <input
              value={baseColor}
              onChange={(e) => setBaseColor(e.target.value)}
              placeholder="#4a2a6a"
              style={{ ...s.input, flex: 1, fontSize: '0.85rem' }}
              maxLength={7}
            />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={s.label}>Accent Color</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ ...s.colorSwatch, background: accentColor || '#d41c5c' }}>
              <input
                type="color"
                value={accentColor || '#d41c5c'}
                onChange={(e) => setAccentColor(e.target.value)}
                style={s.colorHiddenInput}
              />
            </label>
            <input
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              placeholder="#d41c5c"
              style={{ ...s.input, flex: 1, fontSize: '0.85rem' }}
              maxLength={7}
            />
          </div>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={showTextColor}
          onChange={(e) => { setShowTextColor(e.target.checked); if (!e.target.checked) setTextColor(''); }}
        />
        Custom text color
      </label>
      {showTextColor && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ ...s.colorSwatch, background: textColor || '#f0f0f0' }}>
            <input
              type="color"
              value={textColor || '#f0f0f0'}
              onChange={(e) => setTextColor(e.target.value)}
              style={s.colorHiddenInput}
            />
          </label>
          <input
            value={textColor}
            onChange={(e) => setTextColor(e.target.value)}
            placeholder="#f0f0f0"
            style={{ ...s.input, flex: 1, fontSize: '0.85rem' }}
            maxLength={7}
          />
        </div>
      )}

      {/* Preview */}
      {(baseColor || accentColor) && (
        <div style={s.field}>
          <label style={s.label}>Preview</label>
          <SpaceBrandedCard
            name={space?.name || name}
            description={space?.description || slug}
            iconUrl={space?.iconUrl}
            baseColor={baseColor || null}
            accentColor={accentColor || null}
            textColor={(showTextColor && textColor) || null}
          />
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div style={s.stepContent}>
      <h2 style={s.stepTitle}>Discoverability</h2>
      <p style={s.stepDesc}>Choose whether your space appears in the public directory.</p>

      <label style={s.toggleRow}>
        <span>List in Discover Spaces directory</span>
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          style={s.checkbox}
        />
      </label>

      {isPublic && (
        <div style={s.field}>
          <label style={s.label}>Tags (up to 10)</label>
          <div style={s.chipGrid}>
            {publicTags.predefined.map((tag) => (
              <button
                key={tag.slug}
                onClick={() => toggleTag(tag.slug)}
                style={{
                  ...s.chip,
                  background: selectedTags.includes(tag.slug) ? 'var(--accent)' : 'var(--bg-input)',
                  color: selectedTags.includes(tag.slug) ? 'white' : 'var(--text-primary)',
                }}
              >
                {selectedTags.includes(tag.slug) && <Check size={12} />}
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div style={s.stepContent}>
      <h2 style={s.stepTitle}>Text Channels</h2>
      <p style={s.stepDesc}>
        Your space already has <strong>#admin</strong> and <strong>#general</strong>. Add more to organize conversations.
      </p>

      <div style={s.chipGrid}>
        {SUGGESTED_CHANNELS.map((ch) => (
          <button
            key={ch}
            onClick={() => toggleChannel(ch)}
            style={{
              ...s.chip,
              background: selectedChannels.includes(ch) ? 'var(--accent)' : 'var(--bg-input)',
              color: selectedChannels.includes(ch) ? 'white' : 'var(--text-primary)',
            }}
          >
            {selectedChannels.includes(ch) && <Check size={12} />}
            #{ch}
          </button>
        ))}
      </div>

      <div style={s.field}>
        <label style={s.label}>Custom Channel</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={customChannel}
            onChange={(e) => setCustomChannel(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
            placeholder="channel-name"
            style={{ ...s.input, flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customChannel.trim()) {
                if (!selectedChannels.includes(customChannel.trim()) && !SUGGESTED_CHANNELS.includes(customChannel.trim())) {
                  setSelectedChannels((prev) => [...prev, customChannel.trim()]);
                }
                setCustomChannel('');
              }
            }}
          />
          <button
            onClick={() => {
              if (customChannel.trim() && !selectedChannels.includes(customChannel.trim())) {
                setSelectedChannels((prev) => [...prev, customChannel.trim()]);
                setCustomChannel('');
              }
            }}
            style={s.outlineBtn}
            disabled={!customChannel.trim()}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* Show custom channels that were added */}
      {selectedChannels.filter((ch) => !SUGGESTED_CHANNELS.includes(ch)).length > 0 && (
        <div style={s.chipGrid}>
          {selectedChannels.filter((ch) => !SUGGESTED_CHANNELS.includes(ch)).map((ch) => (
            <button
              key={ch}
              onClick={() => toggleChannel(ch)}
              style={{
                ...s.chip,
                background: 'var(--accent)',
                color: 'white',
              }}
            >
              <Check size={12} /> #{ch}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderStep5 = () => (
    <div style={s.stepContent}>
      <h2 style={s.stepTitle}>Community Calendar</h2>
      <p style={s.stepDesc}>Let members create and share events.</p>

      <label style={s.toggleRow}>
        <span>Enable community calendar</span>
        <input
          type="checkbox"
          checked={calendarEnabled}
          onChange={(e) => setCalendarEnabled(e.target.checked)}
          style={s.checkbox}
        />
      </label>

      {calendarEnabled && (
        <>
          <label style={s.toggleRow}>
            <span>Make calendar publicly accessible</span>
            <input
              type="checkbox"
              checked={allowPublicCalendar}
              onChange={(e) => setAllowPublicCalendar(e.target.checked)}
              style={s.checkbox}
            />
          </label>
          {allowPublicCalendar && renderPublicUrl(`app.crab.ac/calendar/${space?.slug || slug}`)}
        </>
      )}

      <p style={s.note}>You can change this anytime in Space Settings &gt; Admin.</p>
    </div>
  );

  const renderStep6 = () => (
    <div style={s.stepContent}>
      <h2 style={s.stepTitle}>Community Blog</h2>
      <p style={s.stepDesc}>Publish articles and updates for your community.</p>

      <label style={s.toggleRow}>
        <span>Enable community blog</span>
        <input
          type="checkbox"
          checked={blogEnabled}
          onChange={(e) => setBlogEnabled(e.target.checked)}
          style={s.checkbox}
        />
      </label>

      {blogEnabled && (
        <>
          <label style={s.toggleRow}>
            <span>Make blog publicly accessible</span>
            <input
              type="checkbox"
              checked={allowPublicBlog}
              onChange={(e) => setAllowPublicBlog(e.target.checked)}
              style={s.checkbox}
            />
          </label>
          {allowPublicBlog && renderPublicUrl(`app.crab.ac/blog/${space?.slug || slug}`)}
        </>
      )}

      <p style={s.note}>You can change this anytime in Space Settings &gt; Admin.</p>
    </div>
  );

  const renderSpecialtySection = (
    label: string,
    expanded: boolean,
    setExpanded: (v: boolean) => void,
    items: { name: string; isPublic: boolean }[],
    setItems: (items: { name: string; isPublic: boolean }[]) => void,
    newName: string,
    setNewName: (v: string) => void,
    urlPrefix: string,
    description: string,
    newIsPublic: boolean,
    setNewIsPublic: (v: boolean) => void,
  ) => {
    const addItem = () => {
      if (newName.trim()) {
        setItems([...items, { name: newName.trim(), isPublic: newIsPublic }]);
        setNewName('');
        setNewIsPublic(false);
      }
    };
    return (
      <div style={s.specialtySection}>
        <button onClick={() => setExpanded(!expanded)} style={s.expandHeader}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>{description}</div>
          </div>
          <ChevronDown
            size={16}
            style={{
              color: 'var(--text-muted)',
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </button>
        {expanded && (
          <div style={{ padding: '0.75rem 12px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {items.map((item, i) => (
              <div key={i} style={s.specialtyItem}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>#{item.name}</span>
                  {item.isPublic && renderPublicUrl(`${urlPrefix}/${space?.slug || slug}`)}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={item.isPublic}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[i] = { ...item, isPublic: e.target.checked };
                      setItems(updated);
                    }}
                  />
                  Public
                </label>
                <button
                  onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderTop: items.length > 0 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                  placeholder="channel-name"
                  style={{ ...s.input, flex: 1, fontSize: '0.85rem' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
                />
                <button onClick={addItem} style={s.outlineBtn} disabled={!newName.trim()}>
                  <Plus size={14} /> Add
                </button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newIsPublic}
                  onChange={(e) => setNewIsPublic(e.target.checked)}
                />
                Make publicly accessible on the web
              </label>
              {newIsPublic && newName.trim() && renderPublicUrl(`${urlPrefix}/${space?.slug || slug}`)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep7 = () => (
    <div style={s.stepContent}>
      <h2 style={s.stepTitle}>Newsletter</h2>
      <p style={s.stepDesc}>Send email newsletters to your community and public subscribers.</p>

      <label style={s.toggleRow}>
        <input
          type="checkbox"
          checked={newsletterEnabled}
          onChange={(e) => setNewsletterEnabled(e.target.checked)}
          style={s.checkbox}
        />
        Enable Newsletter
      </label>

      {newsletterEnabled && (
        <>
          <label style={s.toggleRow}>
            <input
              type="checkbox"
              checked={allowPublicNewsletter}
              onChange={(e) => setAllowPublicNewsletter(e.target.checked)}
              style={s.checkbox}
            />
            Allow public newsletter page
          </label>
        </>
      )}
    </div>
  );

  const renderStep8 = () => (
    <div style={s.stepContent}>
      <h2 style={s.stepTitle}>Specialty Channels</h2>
      <p style={s.stepDesc}>Add galleries, forums, or route libraries.</p>

      {renderSpecialtySection('Galleries', galleryExpanded, setGalleryExpanded, galleries, setGalleries, newGalleryName, setNewGalleryName, 'app.crab.ac/gallery', 'Share photos and media in a visual grid layout', newGalleryPublic, setNewGalleryPublic)}
      {renderSpecialtySection('Forums', forumExpanded, setForumExpanded, forums, setForums, newForumName, setNewForumName, 'app.crab.ac/boards', 'Threaded discussion boards for longer-form topics', newForumPublic, setNewForumPublic)}
      {renderSpecialtySection('Routes', routeExpanded, setRouteExpanded, routes, setRoutes, newRouteName, setNewRouteName, 'app.crab.ac/routes', 'Share and browse GPS routes, trails, and maps', newRoutePublic, setNewRoutePublic)}
    </div>
  );

  const renderStep9 = () => (
    <div style={s.stepContent}>
      <h2 style={s.stepTitle}>Welcome Message</h2>
      <p style={s.stepDesc}>Automatically greet new members when they join.</p>

      <label style={s.toggleRow}>
        <span>Welcome new members in #general</span>
        <input
          type="checkbox"
          checked={welcomeEnabled}
          onChange={(e) => setWelcomeEnabled(e.target.checked)}
          style={s.checkbox}
        />
      </label>

      {welcomeEnabled && (
        <div style={s.field}>
          <label style={s.label}>Message Template</label>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            style={{ ...s.input, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <span style={s.hint}>
            Use {'{{mention}}'} for the new member's @mention and {'{space}'} for the space name.
          </span>
        </div>
      )}

      <p style={s.note}>You can edit this later in Space Settings &gt; Workflows.</p>
    </div>
  );

  const renderDone = () => (
    <div style={s.stepContent}>
      <h2 style={s.stepTitle}>You're All Set!</h2>
      <p style={s.stepDesc}>Your space <strong>{space?.name}</strong> is ready to go.</p>

      {configuredFeatures.length > 0 && (
        <div style={s.field}>
          <label style={s.label}>What you configured</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {configuredFeatures.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                <Check size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={handleGoToSpace} style={s.primaryBtn}>
        Go to Space <ChevronRight size={16} />
      </button>
    </div>
  );

  const renderFooter = () => {
    if (step === 9) return null; // Done screen has its own button

    return (
      <div style={s.footer}>
        {step > 1 && step <= TOTAL_STEPS && (
          <button onClick={() => { setError(''); setStep(step - 1); }} style={s.outlineBtn}>
            Back
          </button>
        )}
        <div style={{ flex: 1 }} />
        {step > 1 && step <= TOTAL_STEPS && (
          <button onClick={handleSkip} style={s.outlineBtn}>
            Skip
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={loading || (step === 1 && !name.trim())}
          style={{
            ...s.primaryBtn,
            opacity: loading || (step === 1 && !name.trim()) ? 0.6 : 1,
          }}
        >
          {loading ? 'Saving...' : step === 1 ? 'Create Space' : step === TOTAL_STEPS ? 'Finish' : 'Next'}
        </button>
      </div>
    );
  };

  const modalStyle: React.CSSProperties = isMobile
    ? { ...s.modal, position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, borderRadius: 0, maxWidth: 'none', maxHeight: 'none' }
    : s.modal;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          {renderStepIndicator()}
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={s.body}>
          {error && <div style={s.error}>{error}</div>}
          {renderStep()}
        </div>

        {/* Footer */}
        {renderFooter()}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    width: '100%',
    maxWidth: 540,
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '16px 20px',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  stepDots: {
    display: 'flex',
    gap: 4,
  },
  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  stepTitle: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 700,
  },
  stepDesc: {
    margin: 0,
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
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
  hint: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  note: {
    margin: 0,
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  colorSwatch: {
    width: 44,
    height: 44,
    minWidth: 44,
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    border: '2px solid var(--border)',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  },
  colorHiddenInput: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
    border: 'none',
    padding: 0,
  },
  iconPreview: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-input)',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: 'pointer',
    accentColor: 'var(--accent)',
  },
  chipGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 16,
    border: 'none',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'background 0.15s, color 0.15s',
  },
  specialtySection: {
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  expandHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-input)',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-primary)',
  },
  specialtyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-input)',
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px 20px',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  outlineBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 14px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  closeBtn: {
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
    marginBottom: 8,
  },
  publicUrlBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    background: 'rgba(88, 166, 255, 0.08)',
    border: '1px solid rgba(88, 166, 255, 0.2)',
  },
  publicUrlLabel: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#58a6ff',
  },
  publicUrl: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#f0c060',
    wordBreak: 'break-all',
  },
};
