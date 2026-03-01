import { useEffect } from 'react';
import { getSocket } from '../lib/socket.js';
import { useChannelsStore } from '../stores/channels.js';
import { useAuthStore } from '../stores/auth.js';

/**
 * Listens for `channel:activity` socket events (emitted to the space room
 * whenever a new message is created) and increments the unread badge for
 * channels the user is NOT currently viewing.
 *
 * Should be mounted once inside SpaceView.
 */
export function useChannelUnreadSocket() {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onActivity = (payload: { channelId: string; authorId: string; messageId: string }) => {
      const userId = useAuthStore.getState().user?.id;
      // Ignore own messages
      if (payload.authorId === userId) return;

      const { activeChannelId, channels, mutedChannels, incrementUnread } = useChannelsStore.getState();
      // Ignore if user is currently viewing this channel
      if (payload.channelId === activeChannelId) return;
      // Ignore if channel is muted
      if (mutedChannels.has(payload.channelId)) return;
      // Only update if the channel belongs to the current space's channel list
      if (!channels.some((c) => c.id === payload.channelId)) return;

      incrementUnread(payload.channelId);
    };

    socket.on('channel:activity', onActivity);

    return () => {
      socket.off('channel:activity', onActivity);
    };
  }, []);
}
