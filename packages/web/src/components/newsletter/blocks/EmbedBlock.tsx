interface Props {
  url: string;
  title?: string | null;
  onUrlChange: (url: string) => void;
  onTitleChange: (title: string) => void;
}

export function EmbedBlockEditor({ url, title, onUrlChange, onTitleChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder="https://..."
        style={{ padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
      />
      <input
        value={title || ''}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Link title (optional)"
        style={{ padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', fontSize: '0.85rem' }}
      />
    </div>
  );
}
