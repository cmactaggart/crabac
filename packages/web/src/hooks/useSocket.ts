import { useEffect } from 'react';
import { getSocket } from '../lib/socket.js';
import { useMessagesStore } from '../stores/messages.js';
import type { Message, Reaction } from '@gud/shared';

export function useChannelSocket(channelId: string | null) {
  const addMessage = useMessagesStore((s) => s.addMessage);
  const updateMessage = useMessagesStore((s) => s.updateMessage);
  const removeMessage = useMessagesStore((s) => s.removeMessage);
  const updateReactions = useMessagesStore((s) => s.updateReactions);
  const setTyping = useMessagesStore((s) => s.setTyping);

  useEffect(() => {
    if (!channelId) return;

    const socket = getSocket();
    if (!socket) return;

    socket.emit('channel:join', { channelId });

    // Re-join channel on reconnect (e.g. after server restart)
    const onReconnect = () => {
      socket.emit('channel:join', { channelId });
    };

    const onNew = (message: Message) => {
      if (message.channelId === channelId) {
        addMessage(message);
      }
    };

    const onUpdated = (message: Message) => {
      if (message.channelId === channelId) {
        updateMessage(message);
      }
    };

    const onDeleted = (payload: { channelId: string; messageId: string }) => {
      if (payload.channelId === channelId) {
        removeMessage(payload.messageId);
      }
    };

    const onReactionsUpdated = (payload: { channelId: string; messageId: string; reactions: Reaction[] }) => {
      if (payload.channelId === channelId) {
        updateReactions(payload.messageId, payload.reactions);
      }
    };

    const onTyping = (payload: { channelId: string; userId: string; username: string }) => {
      if (payload.channelId === channelId) {
        setTyping(payload.userId, payload.username);
      }
    };

    socket.on('connect', onReconnect);
    socket.on('message:new', onNew);
    socket.on('message:updated', onUpdated);
    socket.on('message:deleted', onDeleted);
    socket.on('message:reactions_updated', onReactionsUpdated);
    socket.on('member:typing', onTyping);

    return () => {
      socket.emit('channel:leave', { channelId });
      socket.off('connect', onReconnect);
      socket.off('message:new', onNew);
      socket.off('message:updated', onUpdated);
      socket.off('message:deleted', onDeleted);
      socket.off('message:reactions_updated', onReactionsUpdated);
      socket.off('member:typing', onTyping);
    };
  }, [channelId, addMessage, updateMessage, removeMessage, updateReactions, setTyping]);
}

export function useTypingEmit(channelId: string | null) {
  let lastEmit = 0;

  return () => {
    if (!channelId) return;
    const now = Date.now();
    if (now - lastEmit < 2000) return;
    lastEmit = now;
    const socket = getSocket();
    socket?.emit('message:typing', { channelId });
  };
}
