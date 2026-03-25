import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';

export function registerCalendarGateway() {
  // Meeting room participant joined or left
  eventBus.on('calendar.room.participant_changed', ({ eventId, spaceId, participantCount }) => {
    if (!io) return;

    io.to(`space:${spaceId}`).emit('calendar:room_participant_changed', {
      eventId,
      participantCount,
    });
  });

  // Meeting room closed
  eventBus.on('calendar.room.closed', ({ eventId, spaceId }) => {
    if (!io) return;

    io.to(`space:${spaceId}`).emit('calendar:room_closed', {
      eventId,
    });
  });

  // Public guest joined meeting room
  eventBus.on('calendar.public_guest_joined', ({ eventId, spaceId, guestId, displayName }) => {
    if (!io) return;

    io.to(`space:${spaceId}`).emit('calendar:public_guest_joined', {
      eventId,
      guestId,
      displayName,
    });
  });

  // Public guest left meeting room
  eventBus.on('calendar.public_guest_left', ({ eventId, spaceId, guestId, displayName }) => {
    if (!io) return;

    io.to(`space:${spaceId}`).emit('calendar:public_guest_left', {
      eventId,
      guestId,
      displayName,
    });
  });

  // Public guest kicked from meeting room
  eventBus.on('calendar.public_guest_kicked', ({ eventId, spaceId, guestId, displayName, kickedBy }) => {
    if (!io) return;

    io.to(`space:${spaceId}`).emit('calendar:public_guest_kicked', {
      eventId,
      guestId,
      displayName,
      kickedBy,
    });
  });
}
