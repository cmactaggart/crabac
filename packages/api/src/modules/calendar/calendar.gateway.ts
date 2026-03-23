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
}
