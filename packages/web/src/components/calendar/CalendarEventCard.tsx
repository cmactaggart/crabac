import { useState } from 'react';
import { Calendar, Clock, Tag } from 'lucide-react';
import { api } from '../../lib/api.js';
import { EventDetailModal } from './EventDetailModal.js';
import { CreateEventModal } from './CreateEventModal.js';
import { useHasSpacePermission } from '../settings/SpaceSettingsModal.js';
import { Permissions } from '@crabac/shared';
import type { CalendarEvent } from '@crabac/shared';

export interface CalendarEventEmbed {
  id: string;
  spaceId: string;
  name: string;
  eventDate: string;
  eventTime: string | null;
  description: string | null;
  categoryName: string | null;
  categoryColor: string | null;
}

const CALENDAR_EVENT_REGEX = /\[calendar-event:([\s\S]*?)\]/;

/** Extract a calendar event embed from message content, if present. */
export function extractCalendarEvent(content: string): { embed: CalendarEventEmbed; remainingContent: string } | null {
  const match = content.match(CALENDAR_EVENT_REGEX);
  if (!match) return null;
  try {
    const embed = JSON.parse(match[1]) as CalendarEventEmbed;
    if (!embed.id || !embed.name || !embed.eventDate) return null;
    const remainingContent = content.replace(CALENDAR_EVENT_REGEX, '').trim();
    return { embed, remainingContent };
  } catch {
    return null;
  }
}

interface Props {
  embed: CalendarEventEmbed;
  spaceId: string;
}

export function CalendarEventCard({ embed, spaceId }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const [fullEvent, setFullEvent] = useState<CalendarEvent | null>(null);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [loadError, setLoadError] = useState(false);
  const canManage = useHasSpacePermission(spaceId, Permissions.MANAGE_CALENDAR);

  const d = new Date(embed.eventDate + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  const accentColor = embed.categoryColor || 'var(--accent)';

  const handleClick = async () => {
    setLoadError(false);
    try {
      const event = await api<CalendarEvent>(`/spaces/${spaceId}/calendar/events/${embed.id}`);
      setFullEvent(event);
      setShowDetail(true);
    } catch {
      setLoadError(true);
    }
  };

  return (
    <>
      <div style={{ ...styles.card, borderLeftColor: accentColor }} onClick={handleClick}>
        <div style={styles.cardHeader}>
          <Calendar size={16} style={{ color: accentColor, flexShrink: 0 }} />
          <span style={styles.cardTitle}>{embed.name}</span>
        </div>

        <div style={styles.cardDetails}>
          <div style={styles.detailItem}>
            <Clock size={13} style={{ color: 'var(--text-muted)' }} />
            <span>{dateLabel}{embed.eventTime ? ` at ${embed.eventTime}` : ''}</span>
          </div>
          {embed.categoryName && (
            <div style={styles.detailItem}>
              <Tag size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ ...styles.categoryBadge, background: accentColor }}>
                {embed.categoryName}
              </span>
            </div>
          )}
        </div>

        {embed.description && (
          <p style={styles.description}>
            {embed.description.length > 200
              ? embed.description.slice(0, 200) + '...'
              : embed.description}
          </p>
        )}

        <div style={styles.cardFooter}>
          {loadError
            ? <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>Event may have been deleted</span>
            : <span style={{ color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600 }}>View Event</span>
          }
        </div>
      </div>

      {showDetail && fullEvent && (
        <EventDetailModal
          event={fullEvent}
          spaceId={spaceId}
          canManage={canManage}
          onClose={() => { setShowDetail(false); setFullEvent(null); }}
          onEdit={() => {
            setEditEvent(fullEvent);
            setShowDetail(false);
          }}
        />
      )}

      {editEvent && (
        <CreateEventModal
          spaceId={spaceId}
          editEvent={editEvent}
          onClose={() => setEditEvent(null)}
        />
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderLeft: '4px solid var(--accent)',
    borderRadius: 'var(--radius)',
    padding: '12px 14px',
    maxWidth: 420,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 4,
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  categoryBadge: {
    display: 'inline-block',
    padding: '1px 8px',
    borderRadius: 10,
    fontSize: '0.7rem',
    color: '#fff',
    fontWeight: 600,
  },
  description: {
    margin: '6px 0 4px',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  cardFooter: {
    marginTop: 6,
    paddingTop: 6,
    borderTop: '1px solid var(--border)',
  },
};
