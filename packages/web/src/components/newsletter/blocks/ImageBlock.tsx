import { useRef } from 'react';
import { Upload, X } from 'lucide-react';

interface Props {
  url: string;
  caption?: string | null;
  onUrlChange: (url: string) => void;
  onCaptionChange: (caption: string) => void;
  onUpload: (file: File) => Promise<string>;
}

export function ImageBlockEditor({ url, caption, onUrlChange, onCaptionChange, onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploadedUrl = await onUpload(file);
      onUrlChange(uploadedUrl);
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {url ? (
        <div style={{ position: 'relative' }}>
          <img src={url} alt="" style={{ maxWidth: '100%', borderRadius: 6, maxHeight: 300 }} />
          <button onClick={() => onUrlChange('')} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} style={{ padding: '24px', background: 'var(--bg-secondary)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <Upload size={16} /> Upload Image
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      <input
        value={caption || ''}
        onChange={(e) => onCaptionChange(e.target.value)}
        placeholder="Caption (optional)"
        style={{ padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
      />
    </div>
  );
}
