import type { CalendarEvent } from '@crabac/shared';

interface Props {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  isSelected: boolean;
  onClick: () => void;
}

const MAX_VISIBLE = 3;

export function CalendarDay({ date, isCurrentMonth, isToday, events, isSelected, onClick }: Props) {
  const visibleEvents = events.slice(0, MAX_VISIBLE);
  const overflow = events.length - MAX_VISIBLE;

  return (
    <div
      onClick={onClick}
      style={{
        ...styles.cell,
        opacity: isCurrentMonth ? 1 : 0.35,
        background: isSelected ? 'var(--hover)' : 'transparent',
        borderColor: isToday ? 'var(--accent)' : 'transparent',
      }}
    >
      <span style={{
        ...styles.dayNum,
        ...(isToday ? { background: 'var(--accent)', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : {}),
      }}>
        {date.getDate()}
      </span>
      <div style={styles.eventList}>
        {visibleEvents.map((ev) => (
          <div
            key={ev.id}
            style={{
              ...styles.eventBar,
              background: ev.category?.color || 'var(--accent)',
            }}
            title={ev.name}
          >
            {ev.name}
          </div>
        ))}
        {overflow > 0 && (
          <div style={styles.overflow}>+{overflow} more</div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  cell: {
    minHeight: 80,
    padding: 4,
    cursor: 'pointer',
    border: '2px solid transparent',
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'background 0.1s',
  },
  dayNum: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
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
    color: 'var(--text-muted)',
    padding: '0 4px',
  },
};
