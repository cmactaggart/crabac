import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';

export function registerForumGateway() {
  eventBus.on('forum.thread_created', ({ thread, channelId }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('forum:thread_created', thread);
  });

  eventBus.on('forum.post_created', ({ post, threadId, channelId }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('forum:post_created', { ...post, threadId });
    io.to(`thread:${threadId}`).emit('forum:post_created', post);
  });

  eventBus.on('forum.thread_updated', ({ thread, channelId }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('forum:thread_updated', thread);
    io.to(`thread:${thread.id}`).emit('forum:thread_updated', thread);
  });
}
