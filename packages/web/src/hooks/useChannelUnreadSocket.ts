import { useEffect } from 'react';
import { getSocket } from '../lib/socket.js';
import { useChannelsStore } from '../stores/channels.js';
import { useAuthStore } from '../stores/auth.js';

/**
 * Listens for `channel:activity` socket events and increments unread badges
 * for channels the user is NOT currently viewing.
 *
 * Also re-fetches unreads on socket reconnect to catch up on missed events.
 */
export function useChannelUnreadSocket(spaceId: string | undefined) {
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !spaceId) return;

    const onActivity = (payload: { channelId: string; authorId: string; messageId: string }) => {
      const userId = useAuthStore.getState().user?.id;
      if (payload.authorId === userId) return;

      const { activeChannelId, channels, mutedChannels, incrementUnread } = useChannelsStore.getState();
      if (payload.channelId === activeChannelId) return;
      if (mutedChannels.has(payload.channelId)) return;
      if (!channels.some((c) => c.id === payload.channelId)) return;

      incrementUnread(payload.channelId);
    };

    // Re-fetch unreads on reconnect to catch up on events missed while disconnected
    const onReconnect = () => {
      useChannelsStore.getState().fetchUnreads(spaceId);
    };

    // Re-fetch unreads when tab becomes visible (catches anything missed while backgrounded)
    const onVisible = () => {
      if (!document.hidden) {
        useChannelsStore.getState().fetchUnreads(spaceId);
      }
    };

    socket.on('channel:activity', onActivity);
    socket.on('connect', onReconnect);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      socket.off('channel:activity', onActivity);
      socket.off('connect', onReconnect);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [spaceId]);
}
