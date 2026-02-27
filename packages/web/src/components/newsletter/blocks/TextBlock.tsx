import { useState } from 'react';
import { Eye, Edit3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
  onChange: (content: string) => void;
}

export function TextBlockEditor({ content, onChange }: Props) {
  const [preview, setPreview] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button
          onClick={() => setPreview(!preview)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}
        >
          {preview ? <><Edit3 size={12} /> Edit</> : <><Eye size={12} /> Preview</>}
        </button>
      </div>
      {preview ? (
        <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', minHeight: 80, fontSize: '0.95rem', lineHeight: 1.7 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || '*Empty*'}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your content (markdown supported)..."
          style={{ width: '100%', minHeight: 120, padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
        />
      )}
    </div>
  );
}
