import { useState, useEffect } from 'react';
import { X, MapPinned } from 'lucide-react';
import { useCalendarStore } from '../../stores/calendar.js';
import { useChannelsStore } from '../../stores/channels.js';
import { api } from '../../lib/api.js';
import type { CalendarEvent, RouteItem, Channel } from '@crabac/shared';

interface Props {
  spaceId: string;
  prefillDate?: string; // YYYY-MM-DD
  prefillRouteId?: string;
  editEvent?: CalendarEvent | null;
  onClose: () => void;
  onCreated?: (event: CalendarEvent) => void;
}

export function CreateEventModal({ spaceId, prefillDate, editEvent, prefillRouteId, onClose, onCreated }: Props) {
  const categories = useCalendarStore((s) => s.categories);
  const fetchCategories = useCalendarStore((s) => s.fetchCategories);
  const createEvent = useCalendarStore((s) => s.createEvent);
  const updateEvent = useCalendarStore((s) => s.updateEvent);
  const channels = useChannelsStore((s) => s.channels);

  useEffect(() => { fetchCategories(spaceId); }, [spaceId, fetchCategories]);

  const [name, setName] = useState(editEvent?.name || '');
  const [description, setDescription] = useState(editEvent?.description || '');
  const [eventDate, setEventDate] = useState(editEvent?.eventDate || prefillDate || '');
  const [eventTime, setEventTime] = useState(editEvent?.eventTime || '');
  const [categoryId, setCategoryId] = useState(editEvent?.categoryId || '');
  const [isPublic, setIsPublic] = useState(editEvent?.isPublic || false);
  const [location, setLocation] = useState(editEvent?.location || '');
  const [activityType, setActivityType] = useState(editEvent?.activityType || '');
  const [routeId, setRouteId] = useState(editEvent?.routeId || prefillRouteId || '');
  const [showRouteSelect, setShowRouteSelect] = useState(!!(editEvent?.routeId || prefillRouteId));
  const [routeChannelId, setRouteChannelId] = useState('');
  const [routeOptions, setRouteOptions] = useState<RouteItem[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Recurring event state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'weekly' | 'monthly'>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceByDay, setRecurrenceByDay] = useState<string[]>([]);
  const [recurrenceBySetPos, setRecurrenceBySetPos] = useState(1);
  const [recurrenceUntil, setRecurrenceUntil] = useState('');

  const createSeries = useCalendarStore((s) => s.createSeries);

  const routeLibraryChannels = channels.filter((c: Channel) => c.type === 'route_library');

  // Load routes for selected route channel
  useEffect(() => {
    if (!routeChannelId) { setRouteOptions([]); return; }
    api<RouteItem[]>(`/channels/${routeChannelId}/routes?limit=100&sort=name&order=asc`)
      .then(setRouteOptions)
      .catch(() => setRouteOptions([]));
  }, [routeChannelId]);

  // If prefillRouteId is set, try to find which channel it belongs to
  useEffect(() => {
    if (!prefillRouteId || routeChannelId) return;
    (async () => {
      for (const ch of routeLibraryChannels) {
        try {
          const routes = await api<RouteItem[]>(`/channels/${ch.id}/routes?limit=100&sort=name&order=asc`);
          if (routes.some((r) => r.id === prefillRouteId)) {
            setRouteChannelId(ch.id);
            setRouteOptions(routes);
            return;
          }
        } catch { /* ignore */ }
      }
    })();
  }, [prefillRouteId]);

  const routeLinked = showRouteSelect && !!routeId;

  const handleSubmit = async () => {
    if (!name.trim() || !eventDate) return;
    if (routeLinked && (!location.trim() || !eventTime)) return;
    if (isRecurring && (recurrenceByDay.length === 0 || !recurrenceUntil)) return;
    setSaving(true);
    setError('');
    try {
      if (isRecurring && !editEvent) {
        // Create recurring series
        await createSeries(spaceId, {
          name: name.trim(),
          description: description.trim() || null,
          eventTime: eventTime || null,
          categoryId: categoryId || null,
          isPublic,
          location: location.trim() || null,
          activityType: activityType || null,
          routeId: (showRouteSelect && routeId) ? routeId : null,
          recurrenceRule: {
            freq: recurrenceFreq,
            interval: recurrenceInterval,
            byDay: recurrenceByDay,
            ...(recurrenceFreq === 'monthly' ? { bySetPos: recurrenceBySetPos } : {}),
            dtstart: eventDate,
            until: recurrenceUntil,
          },
        });
      } else {
        const data: any = {
          name: name.trim(),
          description: description.trim() || null,
          eventDate,
          eventTime: eventTime || null,
          categoryId: categoryId || null,
          isPublic,
          location: location.trim() || null,
          activityType: activityType || null,
          routeId: (showRouteSelect && routeId) ? routeId : null,
        };

        if (editEvent) {
          await updateEvent(spaceId, editEvent.id, data);
        } else {
          const created = await createEvent(spaceId, data);
          onCreated?.(created);
        }
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>
            {editEvent ? 'Edit Event' : 'Create Event'}
          </h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>
        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          <label style={styles.label}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Event name"
            style={styles.input}
            autoFocus
          />

          <label style={styles.label}>{isRecurring ? 'Start Date' : 'Date'}</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            style={styles.input}
          />

          {/* Recurring event toggle */}
          {!editEvent && (
            <div style={{ marginTop: 4 }}>
              <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  style={{ margin: 0 }}
                />
                <span style={{ textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Recurring Event</span>
              </label>
              {isRecurring && (
                <div style={{ marginTop: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={recurrenceFreq} onChange={(e) => setRecurrenceFreq(e.target.value as any)} style={{ ...styles.input, width: 'auto', flex: 1 }}>
                      <option value="weekly">Every N weeks</option>
                      <option value="monthly">Nth weekday of month</option>
                    </select>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>every</span>
                    <input
                      type="number"
                      min={1}
                      max={52}
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                      style={{ ...styles.input, width: 60, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{recurrenceFreq === 'weekly' ? 'week(s)' : 'month(s)'}</span>
                  </div>

                  {recurrenceFreq === 'monthly' && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Position:</span>
                      <select value={recurrenceBySetPos} onChange={(e) => setRecurrenceBySetPos(parseInt(e.target.value))} style={{ ...styles.input, width: 'auto' }}>
                        <option value={1}>1st</option>
                        <option value={2}>2nd</option>
                        <option value={3}>3rd</option>
                        <option value={4}>4th</option>
                        <option value={5}>5th</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Days</span>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const).map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setRecurrenceByDay((prev) =>
                              prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
                            );
                          }}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            border: recurrenceByDay.includes(day) ? '2px solid var(--accent)' : '1px solid var(--border)',
                            background: recurrenceByDay.includes(day) ? 'var(--accent)' : 'var(--bg-input)',
                            color: recurrenceByDay.includes(day) ? '#fff' : 'var(--text-secondary)',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {day.charAt(0) + day.charAt(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Date</label>
                    <input
                      type="date"
                      value={recurrenceUntil}
                      onChange={(e) => setRecurrenceUntil(e.target.value)}
                      style={{ ...styles.input, marginTop: 4 }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <label style={styles.label}>{routeLinked ? 'Time' : 'Time (optional)'}</label>
          <input
            type="time"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>{routeLinked ? 'Meet Point' : 'Location (optional)'}</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Coffee shop parking lot"
            style={styles.input}
            maxLength={500}
          />

          <label style={styles.label}>Activity Type (optional)</label>
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            style={styles.input}
          >
            <option value="">None</option>
            <option value="ride">Ride</option>
            <option value="run">Run</option>
            <option value="walk">Walk</option>
          </select>

          <label style={styles.label}>Category (optional)</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            style={styles.input}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Route Selection */}
          {routeLibraryChannels.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showRouteSelect}
                  onChange={(e) => {
                    setShowRouteSelect(e.target.checked);
                    if (!e.target.checked) setRouteId('');
                  }}
                  style={{ margin: 0 }}
                />
                <MapPinned size={14} />
                <span style={{ textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Link a Route</span>
              </label>
              {showRouteSelect && (
                <div style={{ marginTop: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <select
                    value={routeChannelId}
                    onChange={(e) => { setRouteChannelId(e.target.value); setRouteId(''); }}
                    style={styles.input}
                  >
                    <option value="">Select route library...</option>
                    {routeLibraryChannels.map((c) => (
                      <option key={c.id} value={c.id}>#{c.name}</option>
                    ))}
                  </select>
                  {routeOptions.length > 0 && (
                    <select
                      value={routeId}
                      onChange={(e) => setRouteId(e.target.value)}
                      style={styles.input}
                    >
                      <option value="">Select a route...</option>
                      {routeOptions.map((r) => (
                        <option key={r.id} value={r.id}>{r.name} ({r.distanceKm.toFixed(1)} km)</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              style={{ margin: 0 }}
            />
            <span style={{ textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Make Public</span>
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: -4 }}>
            Visible on the public calendar web view
          </span>

          <label style={styles.label}>Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Event description..."
            style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
          />
        </div>
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !eventDate || (routeLinked && (!location.trim() || !eventTime))}
            style={styles.saveBtn}
          >
            {saving ? 'Saving...' : editEvent ? 'Save' : 'Create'}
          </button>
        </div>
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
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    width: 480,
    maxWidth: '90vw',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 'var(--radius)',
  },
  body: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflowY: 'auto',
  },
  label: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  },
  input: {
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
  },
  cancelBtn: {
    padding: '8px 16px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  saveBtn: {
    padding: '8px 16px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
};
