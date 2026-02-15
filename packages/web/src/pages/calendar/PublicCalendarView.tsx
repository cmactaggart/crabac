import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { boardApi } from '../../lib/boardApi.js';
import type { CalendarCategory, CalendarEvent } from '@crabac/shared';

interface SpaceInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const dates: Date[] = [];
  const current = new Date(startDate);
  for (let i = 0; i < 42; i++) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateStr(d: Date): string {
  return formatDateKey(d);
}

export function PublicCalendarView() {
  const { spaceSlug } = useParams();

  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [categories, setCategories] = useState<CalendarCategory[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState('');

  const now = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Load space + categories
  useEffect(() => {
    if (!spaceSlug) return;
    setLoading(true);
    boardApi<{ space: SpaceInfo; categories: CalendarCategory[] }>(`/calendar/${spaceSlug}`)
      .then((data) => {
        setSpace(data.space);
        setCategories(data.categories);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load calendar');
        setLoading(false);
      });
  }, [spaceSlug]);

  // Load events when month changes
  const fetchEvents = useCallback(() => {
    if (!spaceSlug) return;
    setEventsLoading(true);

    const from = new Date(currentYear, currentMonth, 1);
    from.setDate(from.getDate() - from.getDay());
    const to = new Date(currentYear, currentMonth + 1, 0);
    to.setDate(to.getDate() + (6 - to.getDay()));

    boardApi<CalendarEvent[]>(
      `/calendar/${spaceSlug}/events?from=${formatDateStr(from)}&to=${formatDateStr(to)}`,
    )
      .then((data) => {
        setEvents(data);
        setEventsLoading(false);
      })
      .catch(() => {
        setEventsLoading(false);
      });
  }, [spaceSlug, currentMonth, currentYear]);

  useEffect(() => {
    if (!loading && !error) {
      fetchEvents();
    }
  }, [fetchEvents, loading, error]);

  const today = useMemo(() => formatDateKey(new Date()), []);
  const dates = useMemo(() => getMonthGrid(currentYear, currentMonth), [currentYear, currentMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = ev.eventDate;
      const list = map.get(key) || [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const navigateMonth = (delta: number) => {
    setCurrentMonth((m) => {
      let newMonth = m + delta;
      if (newMonth < 0) {
        setCurrentYear((y) => y - 1);
        return 11;
      }
      if (newMonth > 11) {
        setCurrentYear((y) => y + 1);
        return 0;
      }
      return newMonth;
    });
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(now.getMonth());
    setCurrentYear(now.getFullYear());
  };

  const dayEvents = selectedDate ? (eventsByDate.get(selectedDate) || []) : [];

  if (loading) return <div style={s.status}>Loading...</div>;
  if (error) return <div style={s.error}>{error}</div>;

  return (
    <div>
      {/* Space banner */}
      <div style={s.banner}>
        <h1 style={s.spaceName}>{space?.name}</h1>
        {space?.description && <p style={s.description}>{space.description}</p>}
      </div>

      {/* Calendar container */}
      <div style={s.calContainer}>
        {/* Header */}
        <div style={s.calHeader}>
          <h2 style={s.calTitle}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => navigateMonth(-1)} style={s.navBtn} title="Previous month">
              <ChevronLeft size={18} />
            </button>
            <button onClick={goToToday} style={s.todayBtn}>
              Today
            </button>
            <button onClick={() => navigateMonth(1)} style={s.navBtn} title="Next month">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Weekday header */}
        <div style={s.weekdayRow}>
          {WEEKDAYS.map((d) => (
            <div key={d} style={s.weekdayCell}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={s.grid}>
          {eventsLoading && (
            <div style={s.loadingOverlay}>
              <span style={{ color: '#999' }}>Loading...</span>
            </div>
          )}
          {dates.map((date, i) => {
            const dateKey = formatDateKey(date);
            const dayEvts = eventsByDate.get(dateKey) || [];
            const isCurrentMonth = date.getMonth() === currentMonth;
            const isToday = dateKey === today;
            const isSelected = dateKey === selectedDate;

            return (
              <div
                key={i}
                onClick={() => setSelectedDate(dateKey)}
                style={{
                  ...s.cell,
                  opacity: isCurrentMonth ? 1 : 0.35,
                  background: isSelected ? '#e8f0fe' : '#fff',
                  borderColor: isToday ? '#4f46e5' : 'transparent',
                }}
              >
                <span style={{
                  ...s.dayNum,
                  ...(isToday ? {
                    background: '#4f46e5',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 24,
                    height: 24,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  } : {}),
                }}>
                  {date.getDate()}
                </span>
                <div style={s.eventList}>
                  {dayEvts.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        ...s.eventBar,
                        background: ev.category?.color || '#4f46e5',
                      }}
                      title={ev.name}
                    >
                      {ev.name}
                    </div>
                  ))}
                  {dayEvts.length > 3 && (
                    <div style={s.overflow}>+{dayEvts.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day events panel */}
      {selectedDate && (
        <DayPanel
          date={selectedDate}
          events={dayEvents}
          onClose={() => setSelectedDate(null)}
          onEventClick={(ev) => {
            setSelectedDate(null);
            setSelectedEvent(ev);
          }}
        />
      )}

      {/* Event detail overlay */}
      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

// ─── Read-only Day Events Panel ───

function DayPanel({ date, events, onClose, onEventClick }: {
  date: string;
  events: CalendarEvent[];
  onClose: () => void;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const d = new Date(date + 'T00:00:00');
  const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()}>
        <div style={s.panelHeader}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#111' }}>{label}</h3>
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </div>
        <div style={s.panelBody}>
          {events.length === 0 ? (
            <p style={{ color: '#999', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
              No events on this day
            </p>
          ) : (
            events.map((ev) => (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev)}
                style={s.eventRow}
              >
                <span style={{ ...s.dot, background: ev.category?.color || '#4f46e5' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.eventRowName}>{ev.name}</div>
                  <div style={s.eventRowMeta}>
                    {ev.eventTime && <span>{ev.eventTime}</span>}
                    {ev.category && <span>{ev.category.name}</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Read-only Event Detail ───

function EventDetail({ event, onClose }: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const d = new Date(event.eventDate + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.detailModal} onClick={(e) => e.stopPropagation()}>
        <div style={s.panelHeader}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#111' }}>{event.name}</h3>
            {event.category && (
              <span style={{
                display: 'inline-block',
                marginTop: 4,
                padding: '2px 8px',
                borderRadius: 10,
                fontSize: '0.7rem',
                color: '#fff',
                fontWeight: 600,
                background: event.category.color,
              }}>
                {event.category.name}
              </span>
            )}
          </div>
          <button onClick={onClose} style={s.closeBtn}><X size={18} /></button>
        </div>
        <div style={s.detailBody}>
          <div style={s.detailRow}>
            <span style={s.detailLabel}>Date</span>
            <span style={{ color: '#333' }}>{dateLabel}</span>
          </div>
          {event.eventTime && (
            <div style={s.detailRow}>
              <span style={s.detailLabel}>Time</span>
              <span style={{ color: '#333' }}>{event.eventTime}</span>
            </div>
          )}
          {event.creator && (
            <div style={s.detailRow}>
              <span style={s.detailLabel}>Created by</span>
              <span style={{ color: '#333' }}>{event.creator.displayName}</span>
            </div>
          )}
          {event.description && (
            <div style={{ marginTop: 8 }}>
              <span style={s.detailLabel}>Description</span>
              <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#555', whiteSpace: 'pre-wrap' }}>
                {event.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───

const s: Record<string, React.CSSProperties> = {
  status: { textAlign: 'center', padding: 40, color: '#999' },
  error: { textAlign: 'center', padding: 40, color: '#c53030' },
  banner: { marginBottom: 24 },
  spaceName: { margin: 0, fontSize: '1.5rem', color: '#111', fontWeight: 700 },
  description: { margin: '6px 0 0', color: '#666', fontSize: '0.9rem' },

  calContainer: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  calHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #e5e7eb',
  },
  calTitle: { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111' },
  navBtn: {
    background: 'none',
    border: '1px solid #ddd',
    borderRadius: 6,
    color: '#555',
    cursor: 'pointer',
    padding: '4px 8px',
    display: 'flex',
    alignItems: 'center',
  },
  todayBtn: {
    background: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: 6,
    color: '#333',
    cursor: 'pointer',
    padding: '4px 12px',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  weekdayRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    borderBottom: '1px solid #e5e7eb',
  },
  weekdayCell: {
    padding: '6px 0',
    textAlign: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#999',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.6)',
    zIndex: 1,
  },
  cell: {
    minHeight: 80,
    padding: 4,
    cursor: 'pointer',
    border: '2px solid transparent',
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column',
    transition: 'background 0.1s',
  },
  dayNum: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#333',
    marginBottom: 2,
    lineHeight: 1,
  },
  eventList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  eventBar: {
    fontSize: '0.65rem',
    color: '#fff',
    padding: '1px 4px',
    borderRadius: 3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: 1.4,
  },
  overflow: {
    fontSize: '0.6rem',
    color: '#999',
    padding: '0 4px',
  },

  // Overlay shared
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  panel: {
    background: '#fff',
    borderRadius: 10,
    width: 380,
    maxWidth: '90vw',
    maxHeight: '60vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: '1px solid #e5e7eb',
    gap: 12,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#999',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 6,
    flexShrink: 0,
  },
  panelBody: {
    padding: '8px 12px 12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  eventRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    background: 'none',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    color: '#333',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  eventRowName: {
    fontSize: '0.9rem',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#111',
  },
  eventRowMeta: {
    display: 'flex',
    gap: 8,
    fontSize: '0.75rem',
    color: '#999',
  },

  // Detail modal
  detailModal: {
    background: '#fff',
    borderRadius: 10,
    width: 480,
    maxWidth: '90vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  },
  detailBody: {
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  detailRow: {
    display: 'flex',
    gap: 12,
    fontSize: '0.9rem',
    color: '#333',
  },
  detailLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#999',
    letterSpacing: '0.05em',
    minWidth: 80,
  },
};
