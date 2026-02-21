import { useState, useEffect, useRef } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { getSocket } from '../../lib/socket.js';
import { Markdown } from '../common/Markdown.js';
import type { CardInstance, Role } from '@crabac/shared';
import { useChannelsStore } from '../../stores/channels.js';

interface Props {
  cardInstanceId: string;
  spaceId: string;
}

export function InteractiveCard({ cardInstanceId, spaceId }: Props) {
  const [instance, setInstance] = useState<CardInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null); // buttonId being submitted
  const [submitError, setSubmitError] = useState('');
  const mountedRef = useRef(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<{ id: string; username: string; displayName: string }[]>([]);
  const channels = useChannelsStore((s) => s.channels).filter((c) => c.spaceId === spaceId);

  // Fetch roles and members when needed
  useEffect(() => {
    api<Role[]>(`/spaces/${spaceId}/roles`).then(setRoles).catch(() => {});
    api<any[]>(`/spaces/${spaceId}/members`).then((m) =>
      setMembers(m.map((u: any) => ({
        id: u.userId || u.user?.id || u.id,
        username: u.user?.username || u.username || '',
        displayName: u.user?.displayName || u.user?.username || u.displayName || u.username || '',
      }))),
    ).catch(() => {});
  }, [spaceId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch card instance
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<CardInstance>(`/spaces/${spaceId}/workflows/cards/${cardInstanceId}`)
      .then((data) => {
        if (cancelled || !mountedRef.current) return;
        setInstance(data);
        const initial: Record<string, string> = {};
        (data.template?.fields ?? []).forEach((f) => {
          initial[f.key] = data.state?.[f.key] ?? '';
        });
        setFieldValues(initial);
      })
      .catch((err) => {
        if (cancelled || !mountedRef.current) return;
        setError(err?.message || 'Failed to load card');
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cardInstanceId, spaceId]);

  // Socket subscriptions for real-time updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUpdated = (data: { cardInstanceId: string; instance: CardInstance }) => {
      if (data.cardInstanceId !== cardInstanceId) return;
      if (!mountedRef.current) return;
      setInstance(data.instance);
    };

    const handleDismissed = (data: { cardInstanceId: string }) => {
      if (data.cardInstanceId !== cardInstanceId) return;
      if (!mountedRef.current) return;
      setInstance((prev) => prev ? { ...prev, status: 'dismissed' } : prev);
    };

    socket.on('workflow:card_updated', handleUpdated);
    socket.on('workflow:card_dismissed', handleDismissed);

    return () => {
      socket.off('workflow:card_updated', handleUpdated);
      socket.off('workflow:card_dismissed', handleDismissed);
    };
  }, [cardInstanceId]);

  const handleButtonClick = async (buttonId: string) => {
    setSubmitting(buttonId);
    setSubmitError('');
    try {
      await api(
        `/spaces/${spaceId}/workflows/cards/${cardInstanceId}/interact`,
        {
          method: 'POST',
          body: JSON.stringify({ buttonId, fields: fieldValues }),
        },
      );
      // Re-fetch to get the updated instance (socket event may also arrive)
      if (mountedRef.current) {
        const fresh = await api<CardInstance>(`/spaces/${spaceId}/workflows/cards/${cardInstanceId}`);
        if (mountedRef.current) setInstance(fresh);
      }
    } catch (err: any) {
      if (mountedRef.current) setSubmitError(err?.message || 'Action failed');
    } finally {
      if (mountedRef.current) setSubmitting(null);
    }
  };

  // ------------------------------------------------------------------
  // Loading / error / missing states
  // ------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{ ...styles.skeleton, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        Loading card {cardInstanceId}...
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div style={styles.errorCard}>
        <X size={14} style={{ flexShrink: 0, color: 'var(--danger)' }} />
        <span>{error || 'Card not found'} (id: {cardInstanceId})</span>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Dismissed state — collapsed summary
  // ------------------------------------------------------------------

  if (instance.status === 'dismissed' || instance.status === 'expired') {
    const template = instance.template;
    return (
      <div style={styles.dismissedCard}>
        <CheckCircle size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={styles.dismissedTitle}>
          {instance.state?.title ?? template?.name ?? 'Card'}
        </span>
        <span style={styles.dismissedStatus}>
          {instance.status === 'expired' ? 'expired' : 'dismissed'}
          {instance.interactedAt && ` · ${new Date(instance.interactedAt).toLocaleString()}`}
        </span>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Active card
  // ------------------------------------------------------------------

  const template = instance.template;
  const accentColor = template?.color || 'var(--accent)';
  const title = instance.state?.title ?? template?.name ?? 'Card';
  const body = instance.state?.body ?? null;
  const fields = template?.fields ?? [];
  const buttons = template?.buttons ?? [];

  const buttonStyleMap: Record<string, React.CSSProperties> = {
    primary: { background: accentColor, color: 'white', border: 'none' },
    secondary: {
      background: 'var(--bg-tertiary)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border)',
    },
    danger: { background: 'var(--danger)', color: 'white', border: 'none' },
  };

  return (
    <div style={{ ...styles.card, borderLeftColor: accentColor }}>
      {/* Title */}
      <div style={styles.cardTitle}>{title}</div>

      {/* Body (markdown) */}
      {body && (
        <div style={styles.cardBody}>
          <Markdown content={body} />
        </div>
      )}

      {/* Fields */}
      {fields.length > 0 && (
        <div style={styles.fieldsSection}>
          {fields.map((field) => (
            <div key={field.key} style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>{field.label}</label>
              {field.type === 'select' ? (
                <select
                  value={fieldValues[field.key] ?? ''}
                  onChange={(e) => setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  disabled={!!submitting}
                  style={styles.fieldInput}
                >
                  <option value="">Select...</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === 'role' ? (
                <select
                  value={fieldValues[field.key] ?? ''}
                  onChange={(e) => setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  disabled={!!submitting}
                  style={styles.fieldInput}
                >
                  <option value="">Select a role...</option>
                  {roles.filter((r) => !r.isSystem).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              ) : field.type === 'user' ? (
                <select
                  value={fieldValues[field.key] ?? ''}
                  onChange={(e) => setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  disabled={!!submitting}
                  style={styles.fieldInput}
                >
                  <option value="">Select a user...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.displayName} (@{m.username})</option>
                  ))}
                </select>
              ) : field.type === 'channel' ? (
                <select
                  value={fieldValues[field.key] ?? ''}
                  onChange={(e) => setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  disabled={!!submitting}
                  style={styles.fieldInput}
                >
                  <option value="">Select a channel...</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>#{ch.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={fieldValues[field.key] ?? ''}
                  onChange={(e) => setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  disabled={!!submitting}
                  placeholder={field.label}
                  style={styles.fieldInput}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Buttons */}
      {buttons.length > 0 && (
        <div style={styles.buttonRow}>
          {buttons.map((btn) => {
            const isSubmitting = submitting === btn.id;
            return (
              <button
                key={btn.id}
                onClick={() => handleButtonClick(btn.id)}
                disabled={!!submitting}
                style={{
                  ...styles.cardButton,
                  ...buttonStyleMap[btn.style],
                  opacity: submitting && !isSubmitting ? 0.5 : 1,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Processing...' : btn.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Submit error */}
      {submitError && (
        <div style={styles.submitError}>
          <X size={12} /> {submitError}
        </div>
      )}

      {/* Footer: created timestamp */}
      <div style={styles.cardFooter}>
        {new Date(instance.createdAt).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  skeleton: {
    padding: '10px 14px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    borderLeft: '4px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxWidth: 420,
  },
  skeletonBar: {
    height: 14,
    background: 'var(--bg-tertiary)',
    borderRadius: 6,
    width: '80%',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  errorCard: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px',
    background: 'rgba(237,66,69,0.08)',
    border: '1px solid rgba(237,66,69,0.25)',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    maxWidth: 420,
  },
  dismissedCard: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 10px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    maxWidth: 420,
    opacity: 0.7,
  },
  dismissedTitle: {
    fontWeight: 600,
    color: 'var(--text-secondary)',
    fontSize: '0.82rem',
  },
  dismissedStatus: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  card: {
    display: 'inline-flex',
    flexDirection: 'column',
    gap: 0,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderLeft: '4px solid var(--accent)',
    borderRadius: 'var(--radius)',
    padding: '10px 14px',
    maxWidth: 440,
    minWidth: 220,
    boxSizing: 'border-box',
  },
  cardTitle: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
    marginBottom: 4,
    lineHeight: 1.3,
  },
  cardBody: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    marginBottom: 8,
  },
  fieldsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 10,
    paddingTop: 4,
    borderTop: '1px solid var(--border)',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  fieldLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
  },
  fieldInput: {
    padding: '6px 10px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  buttonRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  cardButton: {
    padding: '6px 14px',
    borderRadius: 'var(--radius)',
    fontSize: '0.83rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  submitError: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    padding: '5px 8px',
    background: 'rgba(237,66,69,0.1)',
    border: '1px solid rgba(237,66,69,0.3)',
    borderRadius: 'var(--radius)',
    fontSize: '0.78rem',
    color: 'var(--danger)',
  },
  cardFooter: {
    marginTop: 8,
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    paddingTop: 6,
    borderTop: '1px solid var(--border)',
  },
};
