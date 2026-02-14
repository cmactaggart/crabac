import { LetterIcon } from '../icons/LetterIcon.js';

interface SpaceBrandedCardProps {
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  baseColor?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  memberCount?: number;
  tags?: string[];
  isFeatured?: boolean;
  onClick?: () => void;
  size?: 'normal' | 'featured';
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a1a' : '#f0f0f0';
}

export function SpaceBrandedCard({
  name,
  description,
  iconUrl,
  baseColor,
  accentColor,
  textColor,
  memberCount,
  tags,
  isFeatured,
  onClick,
  size = 'normal',
}: SpaceBrandedCardProps) {
  const hasGradient = baseColor && accentColor;
  const cardBg = hasGradient
    ? `linear-gradient(135deg, ${baseColor} 20%, ${accentColor} 80%)`
    : undefined;

  const resolvedTextColor = textColor || (accentColor ? getContrastColor(accentColor) : undefined);
  const iconSize = size === 'featured' ? 44 : 40;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem',
        borderRadius: 'var(--radius)',
        background: cardBg || 'var(--bg-input)',
        border: isFeatured && accentColor ? `1px solid ${accentColor}` : 'none',
        color: resolvedTextColor || 'var(--text-primary)',
        textAlign: 'left' as const,
        width: '100%',
        cursor: 'pointer',
      }}
    >
      {/* Icon */}
      {iconUrl ? (
        <div style={{
          width: iconSize,
          height: iconSize,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          border: accentColor ? `2px solid ${accentColor}` : undefined,
        }}>
          <img src={iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : (
        <LetterIcon
          letter={name.charAt(0)}
          size={iconSize}
          bg={baseColor || 'var(--accent)'}
          color={baseColor ? getContrastColor(baseColor) : '#fff'}
          gradient={hasGradient ? { base: baseColor!, accent: accentColor! } : undefined}
        />
      )}

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: size === 'featured' ? '0.95rem' : '0.9rem' }}>{name}</div>
        {description && (
          <div style={{
            fontSize: '0.8rem',
            opacity: 0.8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {description}
          </div>
        )}
        {(memberCount !== undefined || (tags && tags.length > 0)) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
            {memberCount !== undefined && (
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                {memberCount} members
              </span>
            )}
            {tags && tags.length > 0 && (
              <div style={{ display: 'flex', gap: '0.25rem', overflow: 'hidden' }}>
                {tags.slice(0, 3).map((tag) => (
                  <span key={tag} style={{
                    padding: '0.1rem 0.4rem',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.15)',
                    fontSize: '0.65rem',
                    opacity: 0.8,
                  }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

export { getContrastColor };
