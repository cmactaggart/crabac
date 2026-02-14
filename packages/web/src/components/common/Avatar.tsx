import { LetterIcon } from '../icons/LetterIcon.js';

interface Props {
  src: string | null;
  name: string;
  size?: number;
  dimmed?: boolean;
  baseColor?: string | null;
  accentColor?: string | null;
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a2e' : '#ffffff';
}

export function Avatar({ src, name, size = 36, dimmed = false, baseColor, accentColor }: Props) {
  const initial = (name || '?').charAt(0).toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          opacity: dimmed ? 0.5 : 1,
        }}
      />
    );
  }

  const hasGradient = !!(baseColor && accentColor);

  return (
    <div style={{ opacity: dimmed ? 0.5 : 1, lineHeight: 0 }}>
      <LetterIcon
        letter={initial}
        size={size}
        bg={hasGradient ? undefined : 'var(--bg-tertiary)'}
        color={hasGradient ? getContrastColor(accentColor!) : 'var(--text-primary)'}
        gradient={hasGradient ? { base: baseColor!, accent: accentColor! } : undefined}
      />
    </div>
  );
}
