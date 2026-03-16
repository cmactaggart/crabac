import { useEffect } from 'react';
import { getSocket } from '../lib/socket.js';
import { useDMStore } from '../stores/dm.js';
import type { DirectMessage, Reaction, LinkEmbed } from '@crabac/shared';

export function useDMSocket(conversationId: string | null) {
  const addMessage = useDMStore((s) => s.addMessage);
  const updateMessage = useDMStore((s) => s.updateMessage);
  const removeMessage = useDMStore((s) => s.removeMessage);
  const updateReactions = useDMStore((s) => s.updateReactions);
  const updateEmbeds = useDMStore((s) => s.updateEmbeds);
  const setTyping = useDMStore((s) => s.setTyping);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Ensure we've joined the socket room for this conversation
    // (handles conversations created after initial socket connect)
    if (conversationId) {
      socket.emit('dm:join', { conversationId });
    }

    const onNew = (message: DirectMessage) => {
      addMessage(message);
    };

    const onUpdated = (message: DirectMessage) => {
      updateMessage(message);
    };

    const onDeleted = (payload: { conversationId: string; messageId: string }) => {
      removeMessage(payload.messageId);
    };

    const onReactionsUpdated = (payload: { conversationId: string; messageId: string; reactions: Reaction[] }) => {
      updateReactions(payload.messageId, payload.reactions);
    };

    const onEmbedsReady = (payload: { conversationId: string; messageId: string; embeds: LinkEmbed[] }) => {
      updateEmbeds(payload.messageId, payload.embeds);
    };

    const onTyping = (payload: { conversationId: string; userId: string; username: string }) => {
      if (payload.conversationId === conversationId) {
        setTyping(payload.userId, payload.username);
      }
    };

    socket.on('dm:new', onNew);
    socket.on('dm:updated', onUpdated);
    socket.on('dm:deleted', onDeleted);
    socket.on('dm:reactions_updated', onReactionsUpdated);
    socket.on('dm:embeds_ready', onEmbedsReady);
    socket.on('dm:typing', onTyping);

    return () => {
      socket.off('dm:new', onNew);
      socket.off('dm:updated', onUpdated);
      socket.off('dm:deleted', onDeleted);
      socket.off('dm:reactions_updated', onReactionsUpdated);
      socket.off('dm:embeds_ready', onEmbedsReady);
      socket.off('dm:typing', onTyping);
    };
  }, [conversationId, addMessage, updateMessage, removeMessage, updateReactions, updateEmbeds, setTyping]);
}

export function useDMTypingEmit(conversationId: string | null) {
  let lastEmit = 0;

  return () => {
    if (!conversationId) return;
    const now = Date.now();
    if (now - lastEmit < 2000) return;
    lastEmit = now;
    const socket = getSocket();
    socket?.emit('dm:typing', { conversationId });
  };
}
