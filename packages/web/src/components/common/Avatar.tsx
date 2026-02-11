interface Props {
  src: string | null;
  name: string;
  size?: number;
  dimmed?: boolean;
}

export function Avatar({ src, name, size = 36, dimmed = false }: Props) {
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

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--bg-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
        opacity: dimmed ? 0.5 : 1,
        color: 'var(--text-primary)',
      }}
    >
      {initial}
    </div>
  );
}
