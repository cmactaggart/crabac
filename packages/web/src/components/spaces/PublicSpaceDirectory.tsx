import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star } from 'lucide-react';
import { useSpacesStore } from '../../stores/spaces.js';
import { SpaceBrandedCard } from './SpaceBrandedCard.js';

interface Props {
  lightTheme?: boolean;
}

export function PublicSpaceDirectory({ lightTheme }: Props) {
  const navigate = useNavigate();
  const { publicSpaces, publicTags, fetchPublicSpaces, fetchPublicTags } = useSpacesStore();
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicSpaces();
    fetchPublicTags();
  }, [fetchPublicSpaces, fetchPublicTags]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPublicSpaces({ search: search || undefined, tag: selectedTag || undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, selectedTag, fetchPublicSpaces]);

  const handleTagClick = useCallback((slug: string) => {
    setSelectedTag((prev) => (prev === slug ? null : slug));
  }, []);

  const featured = publicSpaces.filter((s) => s.isFeatured);
  const allTags = [
    ...publicTags.predefined,
    ...publicTags.inUse.filter((t) => !publicTags.predefined.some((p) => p.slug === t.slug)),
  ];

  const textColor = lightTheme ? '#2e1a1a' : 'var(--text-primary)';
  const mutedColor = lightTheme ? '#7a5a5a' : 'var(--text-muted)';
  const secondaryColor = lightTheme ? '#5a3a3a' : 'var(--text-secondary)';
  const inputBg = lightTheme ? '#e8e0de' : 'var(--bg-input)';
  const chipBg = lightTheme ? '#ddd5d3' : 'var(--bg-input)';

  return (
    <div>
      {/* Featured */}
      {featured.length > 0 && !search && !selectedTag && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: mutedColor, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Star size={12} /> Featured
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {featured.map((space) => (
              <SpaceBrandedCard
                key={space.id}
                name={space.name}
                description={space.description}
                iconUrl={space.iconUrl}
                baseColor={space.baseColor}
                accentColor={space.accentColor}
                textColor={space.textColor}
                memberCount={space.memberCount}
                tags={space.tags}
                isFeatured
                size="featured"
                onClick={() => navigate(`/space/${space.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Search + Tags */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          borderRadius: 'var(--radius)',
          background: inputBg,
        }}>
          <Search size={16} style={{ color: mutedColor, flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search public spaces..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: textColor,
              fontSize: '0.9rem',
              outline: 'none',
            }}
          />
        </div>
      </div>
      {allTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.3rem', marginBottom: '0.75rem' }}>
          {allTags.map((tag) => (
            <button
              key={tag.slug}
              onClick={() => handleTagClick(tag.slug)}
              style={{
                padding: '0.2rem 0.6rem',
                borderRadius: '12px',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: selectedTag === tag.slug ? 'var(--accent)' : chipBg,
                color: selectedTag === tag.slug ? 'white' : secondaryColor,
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* Space cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {publicSpaces.map((space) => (
          <SpaceBrandedCard
            key={space.id}
            name={space.name}
            description={space.description}
            iconUrl={space.iconUrl}
            baseColor={space.baseColor}
            accentColor={space.accentColor}
            textColor={space.textColor}
            memberCount={space.memberCount}
            onClick={() => navigate(`/space/${space.id}`)}
          />
        ))}
      </div>
      {publicSpaces.length === 0 && (
        <p style={{ color: mutedColor, fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
          {search || selectedTag ? 'No spaces found.' : 'No public spaces yet.'}
        </p>
      )}
    </div>
  );
}
