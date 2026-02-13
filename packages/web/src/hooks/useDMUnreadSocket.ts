import { useEffect } from 'react';
import { getSocket } from '../lib/socket.js';
import { useDMStore } from '../stores/dm.js';
import { fireNotification } from '../lib/notifications.js';
import type { DirectMessage } from '@crabac/shared';

/**
 * Global listener that increments DM unread counts when messages arrive
 * for conversations that aren't currently active/open.
 * Should be mounted once at the App level.
 */
export function useDMUnreadSocket(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const socket = getSocket();
    if (!socket) return;

    const onNewDM = (message: DirectMessage) => {
      const store = useDMStore.getState();
      const isActive = message.conversationId === store.activeConversationId;

      if (!isActive) {
        // Increment unread for non-active conversations
        store.incrementUnread(message.conversationId);

        // Fire native/OS notification
        fireNotification(
          message.author.displayName,
          message.content.substring(0, 100),
        );

        // Bump conversation to top with latest message (if conversations loaded)
        useDMStore.setState((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === message.conversationId
              ? { ...c, lastMessage: message, updatedAt: new Date().toISOString() }
              : c,
          ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        }));
      }
    };

    const onConversationCreated = () => {
      useDMStore.getState().fetchConversations();
      useDMStore.getState().fetchDMUnreads();
    };

    socket.on('dm:new', onNewDM);
    socket.on('conversation:created', onConversationCreated);

    return () => {
      socket.off('dm:new', onNewDM);
      socket.off('conversation:created', onConversationCreated);
    };
  }, [active]);
}
