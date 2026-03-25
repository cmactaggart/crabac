import { useEffect, useRef, useState } from 'react';
import { Headphones, Mic, MicOff, PhoneOff, Clock, Users, RotateCcw, Copy, Globe, UserX } from 'lucide-react';
import { useCalendarStore } from '../../stores/calendar.js';
import { useCallStore } from '../../stores/call.js';
import { useSpacesStore } from '../../stores/spaces.js';
import { getSocket } from '../../lib/socket.js';
import { api } from '../../lib/api.js';
import type { CalendarEvent, MeetingRoomGuest } from '@crabac/shared';

interface Props {
  spaceId: string;
  compact?: boolean;
}

function formatTimeUntil(event: CalendarEvent): string {
  if (!event.eventTime || !event.eventDate) return '';
  const eventDateTime = new Date(`${event.eventDate}T${event.eventTime}`);
  const now = new Date();
  const diffMs = eventDateTime.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'starting now';
  if (diffMin < 60) return `starts in ${diffMin}m`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (mins === 0) return `starts in ${hours}h`;
  return `starts in ${hours}h ${mins}m`;
}

function formatEventTime(event: CalendarEvent): string {
  if (!event.eventTime) return '';
  const [h, m] = event.eventTime.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  const time = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
  if (event.endTime) {
    const [eh, em] = event.endTime.split(':').map(Number);
    const eampm = eh >= 12 ? 'PM' : 'AM';
    const ehour12 = eh % 12 || 12;
    return `${time} - ${ehour12}:${String(em).padStart(2, '0')} ${eampm}`;
  }
  return time;
}

export function EventRoomPanel({ spaceId, compact }: Props) {
  const activeRooms = useCalendarStore((s) => s.activeRooms);
  const fetchActiveRooms = useCalendarStore((s) => s.fetchActiveRooms);
  const joinEventRoom = useCalendarStore((s) => s.joinEventRoom);
  const leaveEventRoom = useCalendarStore((s) => s.leaveEventRoom);

  const activeEventId = useCallStore((s) => s.activeEventId);
  const connecting = useCallStore((s) => s.connecting);
  const localAudioMuted = useCallStore((s) => s.localAudioMuted);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const joinEventCall = useCallStore((s) => s.joinEventCall);
  const leaveCall = useCallStore((s) => s.leaveCall);

  const spaces = useSpacesStore((s) => s.spaces);
  const space = spaces.find((s) => s.id === spaceId);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [rejoinRoom, setRejoinRoom] = useState<{ eventId: string; eventName: string } | null>(null);
  const [guests, setGuests] = useState<Record<string, MeetingRoomGuest[]>>({});
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Check if user was in an active event room (for rejoin after refresh)
  useEffect(() => {
    if (activeEventId) return; // already connected
    api<{ room: any }>(`/spaces/${spaceId}/calendar/my-active-room`).then(({ room }) => {
      if (room) {
        setRejoinRoom({ eventId: room.eventId, eventName: room.eventName });
      }
    }).catch(() => {});
  }, [spaceId, activeEventId]);

  const handleRejoin = async () => {
    if (!rejoinRoom) return;
    try {
      const { call, token, channelId } = await joinEventRoom(spaceId, rejoinRoom.eventId);
      await joinEventCall(call, token, rejoinRoom.eventId, channelId, spaceId, rejoinRoom.eventName);
      setRejoinRoom(null);
      fetchActiveRooms(spaceId);
    } catch (err: any) {
      console.error('[EventRoom] Failed to rejoin:', err);
      setRejoinRoom(null);
    }
  };

  // Fetch on mount and poll every 30 seconds
  useEffect(() => {
    fetchActiveRooms(spaceId);
    pollRef.current = setInterval(() => {
      fetchActiveRooms(spaceId);
    }, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [spaceId, fetchActiveRooms]);

  // Listen for socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleRoomChange = () => {
      fetchActiveRooms(spaceId);
    };

    socket.on('calendar:room_participant_changed', handleRoomChange);
    socket.on('calendar:room_closed', handleRoomChange);
    socket.on('calendar:room_opened', handleRoomChange);
    socket.on('calendar:public_guest_joined', handleRoomChange);
    socket.on('calendar:public_guest_left', handleRoomChange);
    socket.on('calendar:public_guest_kicked', handleRoomChange);

    return () => {
      socket.off('calendar:room_participant_changed', handleRoomChange);
      socket.off('calendar:room_closed', handleRoomChange);
      socket.off('calendar:room_opened', handleRoomChange);
      socket.off('calendar:public_guest_joined', handleRoomChange);
      socket.off('calendar:public_guest_left', handleRoomChange);
      socket.off('calendar:public_guest_kicked', handleRoomChange);
    };
  }, [spaceId, fetchActiveRooms]);

  // Compute open/active status client-side based on local time
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const happeningNow: CalendarEvent[] = [];
  const happeningSoon: CalendarEvent[] = [];

  for (const ev of activeRooms.events || []) {
    if (!ev.eventTime || !ev.endTime) continue;
    const [sh, sm] = ev.eventTime.split(':').map(Number);
    const [eh, em] = ev.endTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const early = ev.meetingRoomEarlyEntry ?? 0;

    if (nowMinutes >= endMin) continue; // already ended

    if (early === -1) {
      // Anytime entry
      if (nowMinutes >= startMin) happeningNow.push(ev);
      else happeningSoon.push(ev);
    } else {
      const openMin = startMin - early;
      if (nowMinutes >= startMin && nowMinutes < endMin) {
        happeningNow.push(ev);
      } else if (nowMinutes >= openMin && nowMinutes < startMin) {
        happeningSoon.push(ev);
      }
    }
  }

  if (happeningNow.length === 0 && happeningSoon.length === 0 && !rejoinRoom) return null;

  // Fetch guests for the active event
  useEffect(() => {
    if (!activeEventId) return;
    api<MeetingRoomGuest[]>(`/spaces/${spaceId}/calendar/events/${activeEventId}/meeting/guests`)
      .then((g) => setGuests((prev) => ({ ...prev, [activeEventId]: g })))
      .catch(() => {});
  }, [activeEventId, spaceId]);

  const copyPublicLink = (eventId: string) => {
    if (!space) return;
    const url = `${window.location.origin}/calendar/${space.slug}/meeting/${eventId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(eventId);
      setTimeout(() => setCopiedLink(null), 2000);
    });
  };

  const kickGuest = async (eventId: string, guestId: string) => {
    try {
      await api(`/spaces/${spaceId}/calendar/events/${eventId}/meeting/kick/${guestId}`, { method: 'POST' });
      setGuests((prev) => ({
        ...prev,
        [eventId]: (prev[eventId] || []).filter((g) => g.id !== guestId),
      }));
    } catch {
      // ignore
    }
  };

  const handleJoin = async (event: CalendarEvent) => {
    try {
      const { call, token, channelId } = await joinEventRoom(spaceId, event.id);
      await joinEventCall(call, token, event.id, channelId, spaceId, event.name);
      // Refresh rooms to update participant counts
      fetchActiveRooms(spaceId);
    } catch (err: any) {
      console.error('[EventRoom] Failed to join:', err);
    }
  };

  const handleLeave = async (event: CalendarEvent) => {
    try {
      await leaveCall();
      await leaveEventRoom(spaceId, event.id);
      fetchActiveRooms(spaceId);
    } catch (err: any) {
      console.error('[EventRoom] Failed to leave:', err);
    }
  };

  const renderEvent = (event: CalendarEvent, isNow: boolean) => {
    const isConnected = activeEventId === event.id;
    const participantCount = event.meetingRoom?.participantCount || 0;
    const categoryColor = event.category?.color || 'var(--accent)';

    return (
      <div key={event.id} style={{
        ...styles.eventItem,
        opacity: isNow ? 1 : 0.75,
        borderLeft: compact ? `3px solid ${categoryColor}` : `4px solid ${categoryColor}`,
      }}>
        <div style={styles.eventInfo}>
          <div style={styles.eventName}>{event.name}</div>
          {!compact && event.eventTime && (
            <div style={styles.eventTime}>
              <Clock size={11} />
              {formatEventTime(event)}
            </div>
          )}
          <div style={styles.eventMeta}>
            {isNow ? (
              <span style={{ color: 'var(--success)', fontSize: '0.7rem', fontWeight: 600 }}>Live</span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{formatTimeUntil(event)}</span>
            )}
            {participantCount > 0 && (
              <span style={styles.participantBadge}>
                <Users size={10} />
                {participantCount}
              </span>
            )}
          </div>
        </div>
        <div style={styles.eventActions}>
          {isConnected ? (
            <div style={styles.connectedControls}>
              <div style={styles.connectedLabel}>
                <Headphones size={12} style={{ color: 'var(--success)' }} />
              </div>
              {event.meetingPublicAccess && (
                <button
                  onClick={() => copyPublicLink(event.id)}
                  style={{ ...styles.smallBtn, color: copiedLink === event.id ? 'var(--success)' : 'var(--text-muted)' }}
                  title={copiedLink === event.id ? 'Copied!' : 'Copy public link'}
                >
                  {copiedLink === event.id ? <Globe size={14} /> : <Copy size={14} />}
                </button>
              )}
              <button
                onClick={() => toggleMute()}
                style={{
                  ...styles.smallBtn,
                  color: localAudioMuted ? 'var(--danger)' : 'var(--text-secondary)',
                }}
                title={localAudioMuted ? 'Unmute' : 'Mute'}
              >
                {localAudioMuted ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
              <button
                onClick={() => handleLeave(event)}
                style={{ ...styles.smallBtn, color: 'var(--danger)' }}
                title="Disconnect"
              >
                <PhoneOff size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleJoin(event)}
              disabled={connecting}
              style={styles.joinBtn}
              title="Join meeting room"
            >
              <Headphones size={compact ? 13 : 14} />
              {!compact && 'Join'}
            </button>
          )}
        </div>
        {/* Guest list when connected */}
        {isConnected && !compact && (guests[event.id] || []).length > 0 && (
          <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 4 }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
              <Globe size={9} style={{ verticalAlign: 'middle', marginRight: 3 }} />
              Public Guests ({guests[event.id].length})
            </div>
            {guests[event.id].map((g) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1px 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>{g.displayName}</span>
                <button
                  onClick={() => kickGuest(event.id, g.id)}
                  style={{ ...styles.smallBtn, color: 'var(--text-muted)' }}
                  title="Kick guest"
                >
                  <UserX size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={compact ? styles.compactContainer : styles.container}>
      {rejoinRoom && !activeEventId && (
        <div style={styles.eventItem}>
          <div style={styles.eventInfo}>
            <div style={styles.eventName}>{rejoinRoom.eventName}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>You were in this room</div>
          </div>
          <div style={styles.eventActions}>
            <button onClick={handleRejoin} disabled={connecting} style={styles.joinBtn} title="Rejoin meeting room">
              <RotateCcw size={14} />
              {!compact && 'Rejoin'}
            </button>
          </div>
        </div>
      )}
      {happeningNow.length > 0 && (
        <div>
          {!compact && (
            <div style={styles.sectionHeader}>
              <span style={styles.liveDot} />
              Happening Now
            </div>
          )}
          {happeningNow.map((ev) => renderEvent(ev, true))}
        </div>
      )}
      {happeningSoon.length > 0 && (
        <div>
          {!compact && (
            <div style={styles.sectionHeader}>Happening Soon</div>
          )}
          {happeningSoon.map((ev) => renderEvent(ev, false))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    borderBottom: '1px solid var(--border)',
  },
  compactContainer: {
    padding: '4px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  sectionHeader: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    marginBottom: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--success)',
    display: 'inline-block',
  },
  eventItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    padding: '6px 8px',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-secondary)',
    marginBottom: 2,
  },
  eventInfo: {
    flex: 1,
    minWidth: 0,
  },
  eventName: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  eventTime: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  eventMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  participantBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    background: 'var(--bg-tertiary)',
    padding: '1px 5px',
    borderRadius: 10,
  },
  eventActions: {
    flexShrink: 0,
    marginLeft: 8,
  },
  joinBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '3px 8px',
    borderRadius: 4,
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  connectedControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  connectedLabel: {
    display: 'flex',
    alignItems: 'center',
    padding: 2,
  },
  smallBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 3,
    display: 'flex',
    alignItems: 'center',
    borderRadius: 4,
  },
};
