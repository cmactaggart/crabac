import { GripVertical, Trash2, Plus, Type, Image, Quote, Minus, Link, Heading } from 'lucide-react';
import { useState } from 'react';
import type { NewsletterBlock } from '@crabac/shared';
import { TextBlockEditor } from './blocks/TextBlock.js';
import { ImageBlockEditor } from './blocks/ImageBlock.js';
import { QuoteBlockEditor } from './blocks/QuoteBlock.js';
import { EmbedBlockEditor } from './blocks/EmbedBlock.js';

interface Props {
  blocks: NewsletterBlock[];
  onChange: (blocks: NewsletterBlock[]) => void;
  onUploadImage: (file: File) => Promise<string>;
}

const BLOCK_TYPES = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'image', label: 'Image', icon: Image },
  { type: 'quote', label: 'Quote', icon: Quote },
  { type: 'divider', label: 'Divider', icon: Minus },
  { type: 'embed', label: 'Link', icon: Link },
  { type: 'section_heading', label: 'Heading', icon: Heading },
] as const;

export function NewsletterBlockEditor({ blocks, onChange, onUploadImage }: Props) {
  const [showAddMenu, setShowAddMenu] = useState<number | null>(null);

  const updateBlock = (index: number, updated: NewsletterBlock) => {
    const next = [...blocks];
    next[index] = updated;
    onChange(next);
  };

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const addBlock = (afterIndex: number, type: string) => {
    let newBlock: NewsletterBlock;
    switch (type) {
      case 'text': newBlock = { type: 'text', content: '' }; break;
      case 'image': newBlock = { type: 'image', url: '' }; break;
      case 'quote': newBlock = { type: 'quote', content: '' }; break;
      case 'divider': newBlock = { type: 'divider' }; break;
      case 'embed': newBlock = { type: 'embed', url: '' }; break;
      case 'section_heading': newBlock = { type: 'section_heading', content: '' }; break;
      default: return;
    }
    const next = [...blocks];
    next.splice(afterIndex + 1, 0, newBlock);
    onChange(next);
    setShowAddMenu(null);
  };

  const moveBlock = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {blocks.length === 0 && (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No content blocks yet. Add one below.
        </div>
      )}

      {blocks.map((block, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 4 }}>
            <button onClick={() => moveBlock(i, i - 1)} disabled={i === 0} style={styles.iconBtn} title="Move up">
              <GripVertical size={14} />
            </button>
            <button onClick={() => removeBlock(i)} style={{ ...styles.iconBtn, color: 'var(--danger)' }} title="Delete block">
              <Trash2 size={14} />
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>
              {block.type.replace('_', ' ')}
            </div>
            {renderBlockEditor(block, i, updateBlock, onUploadImage)}
          </div>
        </div>
      ))}

      {/* Add block button */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <button
          onClick={() => setShowAddMenu(showAddMenu === blocks.length ? null : blocks.length)}
          style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '8px 16px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}
        >
          <Plus size={14} /> Add Block
        </button>
        {showAddMenu === blocks.length && (
          <div style={styles.addMenu}>
            {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
              <button key={type} onClick={() => addBlock(blocks.length - 1, type)} style={styles.addMenuItem}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderBlockEditor(
  block: NewsletterBlock,
  index: number,
  updateBlock: (i: number, b: NewsletterBlock) => void,
  onUploadImage: (file: File) => Promise<string>,
) {
  switch (block.type) {
    case 'text':
      return <TextBlockEditor content={block.content} onChange={(content) => updateBlock(index, { ...block, content })} />;

    case 'image':
      return (
        <ImageBlockEditor
          url={block.url}
          caption={block.caption}
          onUrlChange={(url) => updateBlock(index, { ...block, url })}
          onCaptionChange={(caption) => updateBlock(index, { ...block, caption })}
          onUpload={onUploadImage}
        />
      );

    case 'quote':
      return (
        <QuoteBlockEditor
          content={block.content}
          attribution={block.attribution}
          onContentChange={(content) => updateBlock(index, { ...block, content })}
          onAttributionChange={(attribution) => updateBlock(index, { ...block, attribution })}
        />
      );

    case 'divider':
      return <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />;

    case 'embed':
      return (
        <EmbedBlockEditor
          url={block.url}
          title={block.title}
          onUrlChange={(url) => updateBlock(index, { ...block, url })}
          onTitleChange={(title) => updateBlock(index, { ...block, title })}
        />
      );

    case 'section_heading':
      return (
        <input
          value={block.content}
          onChange={(e) => updateBlock(index, { ...block, content: e.target.value })}
          placeholder="Section heading..."
          style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600, boxSizing: 'border-box' }}
        />
      );

    default:
      return null;
  }
}

const styles: Record<string, React.CSSProperties> = {
  iconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 2,
    borderRadius: 4,
  },
  addMenu: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--bg-floating)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: 4,
    display: 'flex',
    gap: 4,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  addMenuItem: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
  },
};
