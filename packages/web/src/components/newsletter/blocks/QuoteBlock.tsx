interface Props {
  content: string;
  attribution?: string | null;
  onContentChange: (content: string) => void;
  onAttributionChange: (attribution: string) => void;
}

export function QuoteBlockEditor({ content, attribution, onContentChange, onAttributionChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '4px solid var(--accent)', paddingLeft: 12 }}>
      <textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Quote text..."
        style={{ width: '100%', minHeight: 60, padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.9rem', fontStyle: 'italic', resize: 'vertical', boxSizing: 'border-box' }}
      />
      <input
        value={attribution || ''}
        onChange={(e) => onAttributionChange(e.target.value)}
        placeholder="Attribution (optional)"
        style={{ padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', fontSize: '0.85rem' }}
      />
    </div>
  );
}
