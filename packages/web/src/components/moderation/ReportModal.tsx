import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../lib/api.js';

interface Props {
  reportedUserId: string;
  reportedUsername: string;
  spaceId?: string;
  channelId?: string;
  messageId?: string;
  dmMessageId?: string;
  conversationId?: string;
  galleryItemId?: string;
  routeId?: string;
  forumPostId?: string;
  messagePreview?: string;
  contentLabel?: string;
  onClose: () => void;
}

export function ReportModal({
  reportedUserId,
  reportedUsername,
  spaceId,
  channelId,
  messageId,
  dmMessageId,
  conversationId,
  galleryItemId,
  routeId,
  forumPostId,
  messagePreview,
  contentLabel = 'Message',
  onClose,
}: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api('/reports', {
        method: 'POST',
        body: JSON.stringify({
          reportedUserId,
          spaceId: spaceId || undefined,
          channelId: channelId || undefined,
          messageId: messageId || undefined,
          dmMessageId: dmMessageId || undefined,
          conversationId: conversationId || undefined,
          galleryItemId: galleryItemId || undefined,
          routeId: routeId || undefined,
          forumPostId: forumPostId || undefined,
          reason: reason.trim(),
        }),
      });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={styles.modal}>
        <h2 style={styles.title}>Report {reportedUsername}</h2>

        {messagePreview && (
          <div style={styles.preview}>
            <div style={styles.previewLabel}>{contentLabel}</div>
            <div style={styles.previewContent}>{messagePreview}</div>
          </div>
        )}

        {success ? (
          <div style={styles.success}>Report submitted successfully</div>
        ) : (
          <>
            {error && <div style={styles.error}>{error}</div>}

            <textarea
              style={styles.textarea}
              placeholder="Describe the issue..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={2000}
              autoFocus
            />

            <button
              onClick={handleSubmit}
              disabled={loading || !reason.trim()}
              style={{
                ...styles.submitBtn,
                opacity: loading || !reason.trim() ? 0.5 : 1,
              }}
            >
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </>
        )}

        <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    background: 'var(--bg-secondary)',
    padding: '2rem',
    borderRadius: 'var(--radius)',
    width: '100%',
    maxWidth: '440px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    position: 'relative',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
  },
  preview: {
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius)',
    padding: '0.8rem',
  },
  previewLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: '0.3rem',
  },
  previewContent: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: 80,
    overflow: 'hidden',
  },
  textarea: {
    padding: '0.7rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
  },
  submitBtn: {
    padding: '0.7rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--danger)',
    color: 'white',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
  success: {
    background: 'rgba(59, 165, 93, 0.15)',
    color: 'var(--success)',
    padding: '0.8rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
    textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '1.5rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
};
