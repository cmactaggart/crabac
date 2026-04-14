import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { Permissions } from '@crabac/shared';
import type { CalendarEvent } from '@crabac/shared';
import { useCalendarStore } from '../../stores/calendar.js';
import { useHasSpacePermission } from '../settings/SpaceSettingsModal.js';
import { CalendarDay } from './CalendarDay.js';
import { DayEventsPanel } from './DayEventsPanel.js';
import { EventDetailModal } from './EventDetailModal.js';
import { CreateEventModal } from './CreateEventModal.js';
import { CreateCategoryModal } from './CreateCategoryModal.js';
import { UpcomingEventsList } from './UpcomingEventsList.js';
import { EventRoomPanel } from './EventRoomPanel.js';
import { ContextMenu, type ContextMenuItem } from '../common/ContextMenu.js';
import { PersonalCollectionPicker } from '../common/PersonalCollectionPicker.js';
import { api } from '../../lib/api.js';

interface Props {
  spaceId: string;
  showBackButton?: boolean;
  onBack?: () => void;
  openEventId?: string | null;
  onEventOpened?: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

  const dates: Date[] = [];
  const current = new Date(startDate);
  // Always show 6 rows
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

const MOBILE_BREAKPOINT = 768;

export function CalendarView({ spaceId, showBackButton, onBack, openEventId, onEventOpened }: Props) {
  const {
    categories, events, selectedDate, selectedEvent,
    upcomingEvents, upcomingLoading,
    currentMonth, currentYear, loading,
    fetchCategories, fetchEvents, fetchUpcomingEvents,
    setSelectedDate, setSelectedEvent, navigateMonth, goToToday, clear,
  } = useCalendarStore();

  const canManage = useHasSpacePermission(spaceId, Permissions.MANAGE_CALENDAR);

  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showPersonalPicker, setShowPersonalPicker] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [prefillDate, setPrefillDate] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch data on mount and when month changes
  useEffect(() => {
    fetchCategories(spaceId);
    fetchUpcomingEvents(spaceId);
  }, [spaceId, fetchCategories, fetchUpcomingEvents]);

  useEffect(() => {
    fetchEvents(spaceId);
  }, [spaceId, currentMonth, currentYear, fetchEvents]);

  useEffect(() => {
    return () => { clear(); };
  }, [spaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open a specific event when requested (e.g. from a notification deep link)
  useEffect(() => {
    if (!openEventId || !spaceId) return;
    let cancelled = false;
    (async () => {
      const existing = events.find((e) => e.id === openEventId) || upcomingEvents.find((e) => e.id === openEventId);
      if (existing) {
        if (!cancelled) setSelectedEvent(existing);
      } else {
        try {
          const ev = await api<CalendarEvent>(`/spaces/${spaceId}/calendar/events/${openEventId}`);
          if (!cancelled) setSelectedEvent(ev);
        } catch { /* event may be deleted or inaccessible */ }
      }
      if (!cancelled) onEventOpened?.();
    })();
    return () => { cancelled = true; };
  }, [openEventId, spaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = useMemo(() => formatDateKey(new Date()), []);
  const dates = useMemo(() => getMonthGrid(currentYear, currentMonth), [currentYear, currentMonth]);

  // Group events by date
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

  const handleDayClick = (dateKey: string) => {
    setSelectedDate(dateKey);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!canManage) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const contextMenuItems: ContextMenuItem[] = [
    {
      label: 'Add Event',
      icon: undefined,
      onClick: () => {
        setPrefillDate('');
        setEditEvent(null);
        setShowCreateEvent(true);
      },
    },
    {
      label: 'Add from My Events',
      icon: undefined,
      onClick: () => setShowPersonalPicker(true),
    },
    {
      label: 'Add Category',
      icon: undefined,
      onClick: () => setShowCreateCategory(true),
    },
  ];

  const dayEvents = selectedDate ? (eventsByDate.get(selectedDate) || []) : [];

  const handleEventClick = (ev: CalendarEvent) => {
    setSelectedEvent(ev);
  };

  const handleCloseCreateEvent = () => {
    setShowCreateEvent(false);
    setEditEvent(null);
    // Refetch upcoming events after create/edit
    fetchUpcomingEvents(spaceId);
  };

  const upcomingPanel = (
    <>
      <EventRoomPanel spaceId={spaceId} />
      <UpcomingEventsList
        spaceId={spaceId}
        events={upcomingEvents}
        loading={upcomingLoading}
        onEventClick={handleEventClick}
      />
    </>
  );

  const calendarGrid = (
    <>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {showBackButton && onBack && (
            <button onClick={onBack} style={styles.navBtn}>
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 style={styles.title}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => navigateMonth(-1)} style={styles.navBtn} title="Previous month">
            <ChevronLeft size={18} />
          </button>
          <button onClick={goToToday} style={styles.todayBtn}>
            Today
          </button>
          <button onClick={() => navigateMonth(1)} style={styles.navBtn} title="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div style={styles.weekdayRow}>
        {WEEKDAYS.map((d) => (
          <div key={d} style={styles.weekdayCell}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={styles.grid} onContextMenu={handleContextMenu}>
        {loading && (
          <div style={styles.loadingOverlay}>
            <span style={{ color: 'var(--text-muted)' }}>Loading...</span>
          </div>
        )}
        {dates.map((date, i) => {
          const dateKey = formatDateKey(date);
          const dayEvts = eventsByDate.get(dateKey) || [];
          return (
            <CalendarDay
              key={i}
              date={date}
              isCurrentMonth={date.getMonth() === currentMonth}
              isToday={dateKey === today}
              events={dayEvts}
              isSelected={dateKey === selectedDate}
              onClick={() => handleDayClick(dateKey)}
            />
          );
        })}
      </div>
    </>
  );

  return (
    <div style={styles.outerContainer}>
      {isMobile ? (
        /* Mobile: calendar on top, upcoming events below */
        <div style={styles.mobileLayout}>
          <div style={styles.mobileCalendar}>{calendarGrid}</div>
          <div style={styles.mobileUpcoming}>{upcomingPanel}</div>
        </div>
      ) : (
        /* Desktop: upcoming on left, calendar on right */
        <div style={styles.desktopLayout}>
          <div style={styles.desktopSidebar}>{upcomingPanel}</div>
          <div style={styles.desktopCalendar}>{calendarGrid}</div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Day events panel */}
      {selectedDate && (
        <DayEventsPanel
          date={selectedDate}
          events={dayEvents}
          canManage={canManage}
          spaceId={spaceId}
          onClose={() => setSelectedDate(null)}
          onEventClick={(ev) => {
            setSelectedDate(null);
            setSelectedEvent(ev);
          }}
          onAddEvent={() => {
            setPrefillDate(selectedDate);
            setEditEvent(null);
            setSelectedDate(null);
            setShowCreateEvent(true);
          }}
        />
      )}

      {/* Event detail */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          spaceId={spaceId}
          canManage={canManage}
          onClose={() => setSelectedEvent(null)}
          onEdit={() => {
            setEditEvent(selectedEvent);
            setSelectedEvent(null);
            setShowCreateEvent(true);
          }}
        />
      )}

      {/* Create/edit event modal */}
      {showCreateEvent && (
        <CreateEventModal
          spaceId={spaceId}
          prefillDate={prefillDate}
          editEvent={editEvent}
          onClose={handleCloseCreateEvent}
        />
      )}

      {/* Create category modal */}
      {showCreateCategory && (
        <CreateCategoryModal
          spaceId={spaceId}
          onClose={() => setShowCreateCategory(false)}
        />
      )}

      {showPersonalPicker && (
        <PersonalCollectionPicker
          type="events"
          onClose={() => setShowPersonalPicker(false)}
          onSelect={async (itemIds) => {
            setShowPersonalPicker(false);
            for (const id of itemIds) {
              try {
                await api(`/users/me/collections/events/${id}/copy`, {
                  method: 'POST',
                  body: JSON.stringify({ spaceId }),
                });
              } catch {}
            }
            // Refresh calendar + upcoming
            fetchEvents(spaceId);
            fetchUpcomingEvents(spaceId);
          }}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  outerContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    height: '100%',
    overflow: 'hidden',
  },
  // Desktop two-column layout
  desktopLayout: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  desktopSidebar: {
    width: 320,
    flexShrink: 0,
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  desktopCalendar: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
  },
  // Mobile stacked layout
  mobileLayout: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  mobileCalendar: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  mobileUpcoming: {
    maxHeight: '40%',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  // Calendar internals
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 700,
  },
  navBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px 8px',
    display: 'flex',
    alignItems: 'center',
  },
  todayBtn: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    padding: '4px 12px',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  weekdayRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  weekdayCell: {
    padding: '6px 0',
    textAlign: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    flex: 1,
    overflowY: 'auto',
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.1)',
    zIndex: 1,
  },
};
