import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { Paperclip, X } from 'lucide-react';
import { getSocket } from '../../lib/socket.js';
import { api } from '../../lib/api.js';
import { useMessagesStore } from '../../stores/messages.js';
import { MentionAutocomplete } from './MentionAutocomplete.js';
import { ChannelAutocomplete } from './ChannelAutocomplete.js';
import { SlashCommandPalette } from './SlashCommandPalette.js';
import { parseSlashCommand } from '../../lib/slashCommands.js';
import type { Message } from '@gud/shared';

interface Props {
  channelId: string;
  onSend: (content: string, replyToId?: string) => Promise<void>;
  replyingTo: Message | null;
  onCancelReply: () => void;
}

export function MessageInput({ channelId, onSend, replyingTo, onCancelReply }: Props) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [channelQuery, setChannelQuery] = useState<string | null>(null);
  const lastTypingEmit = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const emitTyping = () => {
    const now = Date.now();
    if (now - lastTypingEmit.current < 2000) return;
    lastTypingEmit.current = now;
    getSocket()?.emit('message:typing', { channelId });
  };

  const handleContentChange = useCallback((value: string) => {
    setContent(value);

    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);

    // Check for @mention query
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setSlashQuery(null);
      setChannelQuery(null);
    } else {
      setMentionQuery(null);
    }

    // Check for #channel query
    const channelMatch = textBeforeCursor.match(/#([a-z0-9-]*)$/);
    if (channelMatch && !mentionMatch) {
      setChannelQuery(channelMatch[1]);
      setSlashQuery(null);
    } else {
      setChannelQuery(null);
    }

    // Check for slash command query (only at start of input)
    if (value.startsWith('/')) {
      const slashMatch = value.match(/^\/([a-zA-Z]*)$/);
      if (slashMatch) {
        setSlashQuery(slashMatch[1]);
      } else {
        setSlashQuery(null);
      }
    } else {
      setSlashQuery(null);
    }
  }, []);

  const handleMentionSelect = useCallback((username: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);

    // Find where the @ starts
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex === -1) return;

    const newContent = textBeforeCursor.slice(0, atIndex) + `@${username} ` + textAfterCursor;
    setContent(newContent);
    setMentionQuery(null);

    // Restore focus
    setTimeout(() => {
      const newPos = atIndex + username.length + 2;
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }, [content]);

  const handleChannelSelect = useCallback((channelName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);

    const hashIndex = textBeforeCursor.lastIndexOf('#');
    if (hashIndex === -1) return;

    const newContent = textBeforeCursor.slice(0, hashIndex) + `#${channelName} ` + textAfterCursor;
    setContent(newContent);
    setChannelQuery(null);

    setTimeout(() => {
      const newPos = hashIndex + channelName.length + 2;
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }, [content]);

  const handleSlashSelect = useCallback((command: string) => {
    setContent(`/${command} `);
    setSlashQuery(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    let trimmed = content.trim();
    if ((!trimmed && files.length === 0) || sending) return;

    // Process slash commands
    if (trimmed.startsWith('/')) {
      const result = parseSlashCommand(trimmed);
      if (result) {
        trimmed = result.output;
      }
    }

    setSending(true);
    try {
      if (files.length > 0) {
        const formData = new FormData();
        formData.append('content', trimmed);
        if (replyingTo?.id) formData.append('replyToId', replyingTo.id);
        files.forEach((f) => formData.append('files', f));

        const message = await api<Message>(`/channels/${channelId}/messages/upload`, {
          method: 'POST',
          body: formData,
        });
        useMessagesStore.getState().addMessage(message);
      } else {
        await onSend(trimmed, replyingTo?.id);
      }
      setContent('');
      setFiles([]);
      setMentionQuery(null);
      setSlashQuery(null);
      setChannelQuery(null);
    } catch {
      // keep content on failure
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't handle Enter/Tab when autocomplete is open — it captures at document level
    if (mentionQuery !== null || slashQuery !== null || channelQuery !== null) {
      if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        return; // Let the autocomplete handle it
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        setSlashQuery(null);
        setChannelQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape' && replyingTo) {
      onCancelReply();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected].slice(0, 5));
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      {replyingTo && (
        <div style={styles.replyBar}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Replying to <strong>{replyingTo.author?.displayName || 'Unknown'}</strong>
            <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
              {replyingTo.content.slice(0, 80)}{replyingTo.content.length > 80 ? '...' : ''}
            </span>
          </span>
          <button type="button" onClick={onCancelReply} style={styles.cancelReply}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* File preview */}
      {files.length > 0 && (
        <div style={styles.filePreview}>
          {files.map((f, i) => (
            <div key={i} style={styles.fileChip}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                {f.name}
              </span>
              <button type="button" onClick={() => removeFile(i)} style={styles.removeFile}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      <div style={{ ...styles.inputWrapper, position: 'relative' }}>
        {/* Mention autocomplete */}
        {mentionQuery !== null && (
          <MentionAutocomplete
            query={mentionQuery}
            onSelect={handleMentionSelect}
            onClose={() => setMentionQuery(null)}
          />
        )}

        {/* Slash command palette */}
        {slashQuery !== null && (
          <SlashCommandPalette
            query={slashQuery}
            onSelect={handleSlashSelect}
            onClose={() => setSlashQuery(null)}
          />
        )}

        {/* Channel autocomplete */}
        {channelQuery !== null && (
          <ChannelAutocomplete
            query={channelQuery}
            onSelect={handleChannelSelect}
            onClose={() => setChannelQuery(null)}
          />
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={styles.attachBtn}
          title="Attach files"
        >
          <Paperclip size={20} />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            handleContentChange(e.target.value);
            emitTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder={replyingTo ? 'Reply...' : 'Send a message...'}
          rows={1}
          style={styles.textarea}
        />
        <button
          type="submit"
          disabled={(!content.trim() && files.length === 0) || sending}
          style={{
            ...styles.sendBtn,
            opacity: (content.trim() || files.length > 0) ? 1 : 0.4,
          }}
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    padding: '0 16px 16px',
    flexShrink: 0,
  },
  replyBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    marginBottom: 4,
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  cancelReply: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: '2px 6px',
    flexShrink: 0,
  },
  filePreview: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '6px 12px',
    marginBottom: 4,
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
  },
  fileChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    background: 'var(--bg-tertiary)',
    borderRadius: 4,
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  removeFile: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.7rem',
    padding: '0 2px',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    background: 'var(--bg-input)',
    borderRadius: 'var(--radius)',
    padding: '8px 12px',
  },
  attachBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '2px',
    flexShrink: 0,
    lineHeight: 1,
  },
  textarea: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    resize: 'none',
    outline: 'none',
    lineHeight: 1.4,
    maxHeight: 120,
    overflow: 'auto',
  },
  sendBtn: {
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    padding: '6px 16px',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.85rem',
    flexShrink: 0,
  },
};
